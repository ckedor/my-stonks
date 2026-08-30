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
"""

import logging

from app.core.exceptions import ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.domain.assets import ETF, Asset, Exchange, Stock
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.service.asset_service import ASSETS_LIST_CACHE_PREFIX
from app.modules.market_data.service.market_catalogue_service import (
    MARKET_ASSET_TYPES,
    MarketCatalogueReadService,
)

logger = logging.getLogger(__name__)

#: Os catálogos que a sincronização percorre quando ninguém pede um recorte.
#: Cripto fica de fora do padrão de propósito: o universo é grande, muda o
#: tempo todo e cadastrar tudo encheria o app de moedas que ninguém negocia.
DEFAULT_KINDS = ('stock', 'etf', 'fii', 'bdr')

#: Tipos cuja subclasse é a tabela `stock`, que guarda país, setor e indústria.
_STOCK_LIKE = (ASSET_TYPE.STOCK, ASSET_TYPE.BDR)


class AssetCatalogueSyncService:
    """Traz do catálogo o que o cadastro local não sabe manter sozinho."""

    def __init__(
        self,
        *,
        uow: UnitOfWork,
        catalogue: MarketCatalogueReadService,
        cache: RedisService | None = None,
    ) -> None:
        self.uow = uow
        self.catalogue = catalogue
        self.cache = cache or RedisService()

    async def sync(self, kinds: list[str] | None = None, dry_run: bool = True) -> dict:
        """O merge, e o relatório do que ele fez — ou faria."""
        selected = tuple(kinds) if kinds else DEFAULT_KINDS
        unsupported = [kind for kind in selected if kind not in MARKET_ASSET_TYPES]
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
        asset_type_id = int(MARKET_ASSET_TYPES[kind])
        rows = await self.catalogue.fetch_catalogue(kind)
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
