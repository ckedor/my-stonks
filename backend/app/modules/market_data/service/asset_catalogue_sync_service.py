"""Casar o cadastro de ativos do app com o catálogo do provedor.

O app tem dois universos de ativos e eles nunca coincidem por inteiro: o
cadastro local, que é o que se pode negociar e guardar histórico, e o catálogo
do provedor, que é o mercado. A sincronização é um merge, não uma
substituição:

- ticker nos dois lados: o cadastro recebe o nome e o logo do provedor, que é
  quem tem a fonte primária desse dado. Foi um nome errado guardado no banco —
  e não corrigido em lugar nenhum — que motivou esta rotina;
- ticker só no provedor: vira um ativo novo no cadastro, para que a tela de
  mercado mostre o mercado inteiro e não só o que já foi negociado;
- ticker só no cadastro: fica como está. Renda fixa, tesouro, previdência e
  qualquer papel sem cotação pública não estão em catálogo nenhum, e sumir com
  eles apagaria histórico de carteira.

É uma ação manual, e não um job: ela reescreve nomes que a tela mostra, então
quem dispara deve poder ver antes o que vai mudar — daí o `dry_run`, que é o
padrão da rota.

O catálogo da B3 é o único que o provedor lista, então tudo que nasce aqui
nasce com a bolsa brasileira. É a mesma regra que decide o segmento de uma
posição em `portfolio_segment`: sem exchange, ou com B3, o papel é local.

O fundo de investimento é a exceção da fonte, e por um motivo concreto. O
screener da B3 não o lista sob nenhum `type`: quem responde por ele é uma rota
dedicada do provedor, a mesma que desenha a tela de fundos. Enquanto a
sincronização percorria só o screener, o cadastro não tinha nenhum ativo do
tipo FI, e cada linha daquela tabela aparecia sem `asset_id` — visível e não
clicável, porque o fundo não existia aqui. Sincronizar FI pelo mesmo universo
que a tela desenha é o que faz uma linha sempre ter para onde levar.
"""

import logging

from app.core.exceptions import ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.domain.assets import ETF, Asset, Exchange, Stock
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.service.asset_service import ASSETS_LIST_CACHE_PREFIX
from app.modules.market_data.service.fii_service import FIIMarketReadService
from app.modules.market_data.service.investment_fund_service import (
    InvestmentFundMarketReadService,
)
from app.modules.market_data.service.market_catalogue_service import (
    MARKET_ASSET_TYPES,
    MarketCatalogueReadService,
)

logger = logging.getLogger(__name__)

#: Os catálogos que a sincronização percorre quando ninguém pede um recorte.
#: Cripto fica de fora do padrão de propósito: o universo é grande, muda o
#: tempo todo e cadastrar tudo encheria o app de moedas que ninguém negocia.
DEFAULT_KINDS = ('stock', 'etf', 'fii', 'bdr', 'fi')

#: O que a sincronização aceita, que é mais do que o screener sabe listar:
#: `MARKET_ASSET_TYPES` é o universo da tela de catálogo, e o fundo de
#: investimento entra aqui porque tem fonte própria em `_catalogue_rows`.
SYNC_ASSET_TYPES = {**MARKET_ASSET_TYPES, 'fi': ASSET_TYPE.FI}

#: Tipos cuja subclasse é a tabela `stock`, que guarda país, setor e indústria.
_STOCK_LIKE = (ASSET_TYPE.STOCK, ASSET_TYPE.BDR)


class AssetCatalogueSyncService:
    """Traz do catálogo o que o cadastro local não sabe manter sozinho."""

    def __init__(
        self,
        *,
        uow: UnitOfWork,
        catalogue: MarketCatalogueReadService,
        fii_market: FIIMarketReadService | None = None,
        investment_fund: InvestmentFundMarketReadService | None = None,
        cache: RedisService | None = None,
    ) -> None:
        self.uow = uow
        self.catalogue = catalogue
        self.fii_market = fii_market
        self.investment_fund = investment_fund
        self.cache = cache or RedisService()

    async def sync(self, kinds: list[str] | None = None, dry_run: bool = True) -> dict:
        """O merge, e o relatório do que ele fez — ou faria."""
        selected = tuple(kinds) if kinds else DEFAULT_KINDS
        unsupported = [kind for kind in selected if kind not in SYNC_ASSET_TYPES]
        if unsupported:
            raise ValidationError('Unsupported market catalogue', context={'kinds': unsupported})

        report = {
            'dry_run': dry_run,
            'kinds': list(selected),
            'created': [],
            'updated': [],
            'unchanged': 0,
            'kept_local': [],
        }

        for kind in selected:
            await self._sync_kind(kind, dry_run, report)

        if not dry_run and (report['created'] or report['updated']):
            await self._invalidate_asset_list_cache()

        return report

    async def _sync_kind(self, kind: str, dry_run: bool, report: dict) -> None:
        asset_type_id = int(SYNC_ASSET_TYPES[kind])
        rows = await self._catalogue_rows(kind)
        by_ticker = {row['ticker'].upper(): row for row in rows if row.get('ticker')}

        async with self.uow as uow:
            existing = await uow.assets.get(Asset, by={'asset_type_id': asset_type_id})
            exchange_id = await self._brazilian_exchange_id(uow)

            seen: set[str] = set()
            for asset in existing:
                ticker = (asset.ticker or '').strip().upper()
                row = by_ticker.get(ticker) if ticker else None
                if row is None:
                    report['kept_local'].append({
                        'kind': kind,
                        'ticker': asset.ticker,
                        'name': asset.name,
                    })
                    continue

                seen.add(ticker)
                changes = self._changes(asset, row)
                if not changes:
                    report['unchanged'] += 1
                    continue

                report['updated'].append({'kind': kind, 'ticker': ticker, 'changes': changes})
                if not dry_run:
                    for field, (_, new_value) in changes.items():
                        setattr(asset, field, new_value)

            for ticker, row in by_ticker.items():
                if ticker in seen:
                    continue
                report['created'].append({'kind': kind, 'ticker': ticker, 'name': row['name']})
                if not dry_run:
                    await self._create(uow, row, asset_type_id, exchange_id)

            if not dry_run:
                await uow.commit()

    async def _catalogue_rows(self, kind: str) -> list[dict]:
        """O universo de uma classe, na fonte que sabe respondê-la.

        O provedor é sempre o mesmo; as rotas dele, não. O screener da B3
        responde bem por ação, ETF e BDR, mas o `type=fund` dele é um balaio:
        devolve o próprio código no lugar do nome — 669 dos 671 vêm assim — e
        mistura numa lista só o fundo imobiliário, o Fiagro e o FI-Infra. Um
        catálogo sem nome e sem classe não é catálogo: era ele que reescrevia
        "BTGP LOGISTICA FII" como "BTLG11" e cadastrava o BISE11 como FII.

        As rotas dedicadas respondem o que ele não sabe. Cada uma traz nome de
        verdade em todas as linhas, e saber de qual delas o ticker veio é o
        que decide o tipo do ativo. Elas não trazem logo, e não precisam:
        `_changes` ignora campo vazio, então o que falta aqui não apaga o que
        o cadastro já tem.
        """
        if kind == 'fii' and self.fii_market is not None:
            return self._tickers_and_names(await self.fii_market.list_market())
        if kind == 'fi' and self.investment_fund is not None:
            return self._tickers_and_names(await self.investment_fund.list_market())
        return await self.catalogue.fetch_catalogue(kind)

    @staticmethod
    def _tickers_and_names(market: dict) -> list[dict]:
        return [
            {'ticker': fund['ticker'], 'name': fund['name']}
            for fund in market['funds']
            if fund.get('ticker')
        ]

    @staticmethod
    def _changes(asset: Asset, row: dict) -> dict[str, tuple]:
        """O que o provedor sabe e o cadastro discorda, campo a campo.

        Um campo vazio no provedor não é uma correção: apagar o nome de um
        ativo porque o catálogo veio sem ele seria trocar um dado velho por
        nenhum.

        """
        changes: dict[str, tuple] = {}
        name = (row.get('name') or '').strip()
        if name and name != asset.name:
            changes['name'] = (asset.name, name)
        logo_url = (row.get('logo_url') or '').strip()
        if logo_url and logo_url != asset.logo_url:
            changes['logo_url'] = (asset.logo_url, logo_url)
        return changes

    @staticmethod
    async def _create(uow, row: dict, asset_type_id: int, exchange_id: int | None) -> None:
        asset_ids = await uow.assets.create(
            Asset,
            {
                'ticker': row['ticker'],
                'name': row['name'],
                'asset_type_id': asset_type_id,
                'exchange_id': exchange_id,
                'logo_url': row.get('logo_url'),
            },
        )
        asset_id = asset_ids[0]

        # A subclasse nasce vazia: o catálogo não traz setor, indústria nem
        # segmento, e uma linha vazia é o que permite preenchê-los depois pelo
        # cadastro sem descobrir que a linha não existia. O FII fica de fora
        # porque a dele só existe quando há segmento — é assim que o cadastro
        # de ativos já a cria.
        if asset_type_id in [int(kind) for kind in _STOCK_LIKE]:
            await uow.assets.create(Stock, {'asset_id': asset_id})
        elif asset_type_id == int(ASSET_TYPE.ETF):
            await uow.assets.create(ETF, {'asset_id': asset_id})

    @staticmethod
    async def _brazilian_exchange_id(uow) -> int | None:
        exchange = await uow.assets.get(Exchange, by={'code': EXCHANGE.B3.value}, first=True)
        return exchange.id if exchange else None

    async def _invalidate_asset_list_cache(self) -> None:
        try:
            await self.cache.delete_prefix(f'{ASSETS_LIST_CACHE_PREFIX}:')
        except Exception as exc:
            logger.warning('Asset list cache invalidation failed after sync: %s', exc)
