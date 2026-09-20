"""Casar o cadastro de ativos com o que o regulador publica sobre companhias.

Duas metades, com fontes distintas e a mesma regra de escrita.

A primeira preenche a tabela de pessoas jurídicas: as companhias abertas vêm do
cadastro da CVM, e as administradoras vêm do cadastro de fundos que a aplicação
já ingere toda semana — não adianta baixar de novo um arquivo que já está no
banco.

A segunda liga a ação à companhia que a emitiu. O formulário cadastral é o único
lugar da base aberta que diz que `PETR4` é da Petrobras; com esse vínculo o
informe de imposto passa a declarar o CNPJ certo em vez do CNPJ da corretora.

Nada é escrito sem revisão: o sync compara, devolve o diff, e quem aplica é
quem leu. É a mesma forma de `POST /market_data/asset/sync`.
"""

import asyncio
from datetime import UTC, date, datetime

from app.config.logger import logger
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.exceptions import IntegrationBadResponse
from app.infra.integrations.cvm_client import (
    COMPANY_REGISTRY_PATH,
    CvmClient,
    DownloadedFile,
    NotPublished,
    company_form_path,
)
from app.modules.market_data.adapters.company_filings import (
    iter_company_rows,
    iter_security_rows,
    latest_companies,
    latest_securities,
)
from app.modules.market_data.domain.assets import Asset, Institution, Stock
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.enums import EXCHANGE, AssetStatus
from app.modules.market_data.domain.market_scope import is_brazilian_market

#: Só ação. O BDR fica de fora de propósito: quem o emite é uma companhia
#: estrangeira, que não entrega formulário cadastral no Brasil, então nenhum
#: dos 865 BDRs do cadastro pode casar com este arquivo. Incluí-los só
#: encheria o relatório de 1.308 linhas que nunca vão ter resposta aqui.
_SYNCED_ASSET_TYPES = (ASSET_TYPE.STOCK,)

#: Campos da pessoa jurídica que o cadastro da CVM mantém.
_INSTITUTION_FIELDS = ('name', 'legal_name', 'cvm_code', 'status', 'registered_at')

#: Quantos formulários anteriores ler, além do do ano corrente.
#:
#: O formulário é anual e entregue no meio do ano, então em janeiro o do ano
#: corrente pode nem existir. Mas o buraco é maior que isso: uma companhia
#: pode simplesmente parar de declarar um código que continua negociando —
#: a EMBR3 aparece de 2022 a 2024 e some de 2025 em diante. Um ano só cobre
#: ~530 códigos; cinco cobrem 634. Ano antigo nunca sobrescreve ano novo,
#: porque `latest_securities` ordena por data de referência e versão: ele só
#: preenche o que ninguém mais declarou.
_FORM_YEARS_BACK = 4

#: `Mercado` no formulário; só o que é negociado em bolsa recebe a B3.
_EXCHANGE_MARKET = 'Bolsa'


def _displayable(changes: dict[str, tuple]) -> dict[str, tuple]:
    """O antes e o depois como texto, só para o relatório."""
    return {
        field: (None if before is None else str(before), None if after is None else str(after))
        for field, (before, after) in changes.items()
    }


class CvmRegistrySyncService:
    def __init__(self, *, uow: UnitOfWork, client: CvmClient) -> None:
        self.uow = uow
        self.client = client

    async def sync(self, *, dry_run: bool = True, today: date | None = None) -> dict:
        """O merge, e o relatório do que ele fez — ou faria."""
        today = today or datetime.now(UTC).date()
        report: dict = {
            'dry_run': dry_run,
            'institutions': {'created': [], 'updated': [], 'unchanged': 0},
            'assets': {
                'updated': [],
                'unchanged': 0,
                'unmatched': [],
                'skipped_foreign': 0,
            },
        }

        companies = await self._read_companies()
        live, ended = await self._read_securities(today)

        async with self.uow as uow:
            await self._sync_institutions(uow, companies, dry_run, report)
            await self._sync_administrators(uow, dry_run, report)
            if not dry_run:
                # As pessoas jurídicas precisam existir antes de um ativo poder
                # apontar para elas, e o id só existe depois do flush.
                await uow.commit()

        async with self.uow as uow:
            await self._sync_stocks(uow, live, ended, dry_run, report)
            if not dry_run:
                await uow.commit()

        return report

    # --- leitura dos arquivos ------------------------------------------------

    async def _read_companies(self) -> list[dict]:
        async with self.client.download(COMPANY_REGISTRY_PATH) as result:
            if isinstance(result, NotPublished):
                raise IntegrationBadResponse(
                    f'CVM does not publish {COMPANY_REGISTRY_PATH}', provider='cvm'
                )
            if not isinstance(result, DownloadedFile):
                raise IntegrationBadResponse(
                    f'CVM answered {COMPANY_REGISTRY_PATH} with no body', provider='cvm'
                )
            # Arquivo pequeno (~1 MB): drenar inteiro numa thread é mais
            # simples do que paginar, e não bloqueia o loop.
            rows = await asyncio.to_thread(lambda: latest_companies(iter_company_rows(result.path)))
        return rows

    async def _read_securities(self, today: date) -> tuple[dict[str, dict], dict[str, dict]]:
        """Os papéis do formulário, separados entre os que negociam e os que não.

        A separação não é cosmética. O arquivo carrega código histórico: `PNC`
        está lá como a AGROINDUSTRIAL VERA CRUZ, que saiu da bolsa em 1996, e
        casá-lo com o `PNC` do cadastro — o banco americano — trocaria a bolsa
        de um papel vivo pela de um papel morto. Um código encerrado não
        identifica ativo nenhum; ele só serve como indício de que o ativo de
        mesmo código, se for brasileiro, também está encerrado.

        Um ano ausente não é erro: em janeiro o arquivo do ano corrente pode
        nem existir ainda, e é exatamente por isso que o anterior é lido.
        """
        collected: list[dict] = []
        for year in range(today.year - _FORM_YEARS_BACK, today.year + 1):
            path = company_form_path(year)
            async with self.client.download(path) as result:
                if not isinstance(result, DownloadedFile):
                    logger.info('CVM company form not published for %s', year)
                    continue
                rows = await asyncio.to_thread(list, iter_security_rows(result.path))
            collected.extend(rows)

        newest = latest_securities(collected)
        live, ended = {}, {}
        for ticker, row in newest.items():
            target = ended if row['delisted_at'] and row['delisted_at'] < today else live
            target[ticker] = row
        return live, ended

    # --- pessoas jurídicas ---------------------------------------------------

    async def _sync_institutions(
        self, uow, companies: list[dict], dry_run: bool, report: dict
    ) -> None:
        stored = await uow.assets.get(Institution)
        by_cnpj = {institution.cnpj: institution for institution in stored}

        for row in companies:
            institution = by_cnpj.get(row['cnpj'])
            if institution is None:
                report['institutions']['created'].append({'cnpj': row['cnpj'], 'name': row['name']})
                if not dry_run:
                    await uow.assets.create(
                        Institution,
                        {field: row[field] for field in ('cnpj', 'country', *_INSTITUTION_FIELDS)},
                    )
                continue

            changes = self._institution_changes(institution, row)
            if not changes:
                report['institutions']['unchanged'] += 1
                continue
            report['institutions']['updated'].append({
                'cnpj': row['cnpj'],
                'name': row['name'],
                'changes': _displayable(changes),
            })
            if not dry_run:
                for field, (_, new_value) in changes.items():
                    setattr(institution, field, new_value)

    @staticmethod
    def _institution_changes(institution: Institution, row: dict) -> dict[str, tuple]:
        """O que o regulador diz e o cadastro discorda, campo a campo.

        Campo vazio na fonte não corrige nada: trocar um nome guardado por
        nenhum seria perder dado, não atualizá-lo.
        """
        changes: dict[str, tuple] = {}
        for field in _INSTITUTION_FIELDS:
            new_value = row.get(field)
            if new_value in (None, ''):
                continue
            current = getattr(institution, field)
            if current != new_value:
                # Os valores vão crus: eles são gravados, e uma data virada
                # texto aqui chegaria como texto na coluna DATE. Quem exibe
                # é que formata.
                changes[field] = (current, new_value)
        return changes

    async def _sync_administrators(self, uow, dry_run: bool, report: dict) -> None:
        """As administradoras que o cadastro de fundos já trouxe e ninguém ligou.

        Elas chegam pela ingestão semanal do registro, então o que falta aqui é
        só dar entidade às novas — sem baixar nada.
        """
        pending = await uow.fund_registry.get_unlinked_administrators()
        if not pending:
            return

        stored = await uow.assets.get(Institution)
        by_cnpj = {institution.cnpj: institution for institution in stored}

        for row in pending:
            if row['cnpj'] in by_cnpj:
                continue
            report['institutions']['created'].append({
                'cnpj': row['cnpj'],
                'name': row['name'],
                'role': 'administrator',
            })
            if not dry_run:
                await uow.assets.create(
                    Institution,
                    {
                        'cnpj': row['cnpj'],
                        'name': row['name'],
                        'legal_name': row['name'],
                        'country': 'BR',
                    },
                )
        if not dry_run:
            await uow.fund_registry.link_administrators()

    # --- ações ---------------------------------------------------------------

    async def _sync_stocks(
        self,
        uow,
        live: dict[str, dict],
        ended: dict[str, dict],
        dry_run: bool,
        report: dict,
    ) -> None:
        institutions = await uow.assets.get(Institution)
        institution_by_cnpj = {item.cnpj: item.id for item in institutions}
        exchange_id = await uow.assets.get_exchange_id(EXCHANGE.B3.value)

        # `stock` é carregado junto: a subclasse é lida para todo ativo, e sem
        # isso cada acesso viraria um lazy load dentro de sessão assíncrona.
        assets = await uow.assets.get(
            Asset,
            by={'asset_type_id__in': [int(kind) for kind in _SYNCED_ASSET_TYPES]},
            relations=['stock'],
        )
        for asset in assets:
            ticker = (asset.ticker or '').strip().upper()
            # O arquivo é da CVM, então ele só fala de papel brasileiro. Casar
            # um ativo de fora com ele é o que faria o PNC do cadastro virar
            # uma companhia que saiu da B3 em 1996. A regra de mercado é a
            # mesma que decide o segmento de uma posição.
            if not ticker or not is_brazilian_market(
                asset.exchange.code if asset.exchange else None, asset.ticker
            ):
                report['assets']['skipped_foreign'] += 1
                continue

            row = live.get(ticker)
            if row is None:
                if ticker in ended:
                    await self._collect(report, asset, self._delisting_change(asset), dry_run, uow)
                else:
                    report['assets']['unmatched'].append({
                        'ticker': asset.ticker,
                        'name': asset.name,
                    })
                continue

            changes = self._asset_changes(asset, row, institution_by_cnpj, exchange_id)
            await self._collect(report, asset, changes, dry_run, uow)

    @staticmethod
    def _delisting_change(asset: Asset) -> dict[str, tuple]:
        """O papel só aparece no arquivo com negociação encerrada."""
        if asset.status == AssetStatus.DELISTED:
            return {}
        return {'status': (asset.status, str(AssetStatus.DELISTED))}

    async def _collect(self, report, asset, changes, dry_run, uow) -> None:
        if not changes:
            report['assets']['unchanged'] += 1
            return
        report['assets']['updated'].append({
            'ticker': (asset.ticker or '').upper(),
            'changes': changes,
        })
        if not dry_run:
            await self._apply_asset_changes(uow, asset, changes)

    def _asset_changes(
        self,
        asset: Asset,
        row: dict,
        institution_by_cnpj: dict[str, int],
        exchange_id: int | None,
    ) -> dict[str, tuple]:
        changes: dict[str, tuple] = {}

        institution_id = institution_by_cnpj.get(row['cnpj'])
        if institution_id is not None and asset.institution_id != institution_id:
            changes['institution_id'] = (asset.institution_id, institution_id)

        # A bolsa só é afirmada para o que o formulário diz ser negociado em
        # bolsa. Preencher isso é o que faz a regra de mercado do segmento
        # parar de depender do formato do ticker para decidir.
        if (
            row['market'] == _EXCHANGE_MARKET
            and exchange_id is not None
            and asset.exchange_id != exchange_id
        ):
            changes['exchange_id'] = (asset.exchange_id, exchange_id)

        # A linha veio do conjunto vivo, então ela afirma que o papel negocia.
        if asset.status != AssetStatus.ACTIVE:
            changes['status'] = (asset.status, str(AssetStatus.ACTIVE))

        stock = asset.stock
        for field in ('share_class', 'listing_segment'):
            new_value = row.get(field)
            if new_value and (stock is None or getattr(stock, field) != new_value):
                current = getattr(stock, field, None) if stock else None
                changes[field] = (current, new_value)
        return changes

    @staticmethod
    async def _apply_asset_changes(uow, asset: Asset, changes: dict[str, tuple]) -> None:
        stock_fields = {'share_class', 'listing_segment'}
        for field, (_, new_value) in changes.items():
            if field in stock_fields:
                continue
            setattr(asset, field, new_value)

        pending_stock = {
            field: new_value for field, (_, new_value) in changes.items() if field in stock_fields
        }
        if not pending_stock:
            return
        if asset.stock is None:
            await uow.assets.create(Stock, {'asset_id': asset.id, **pending_stock})
            return
        for field, new_value in pending_stock.items():
            setattr(asset.stock, field, new_value)
