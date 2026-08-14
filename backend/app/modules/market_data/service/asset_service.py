# app/modules/asset/service/asset_service.py
"""
Asset service - handles asset management operations.
"""

import contextlib

from app.config.logger import logger
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.domain.assets import (
    ETF,
    FII,
    Asset,
    AssetType,
    ETFSegment,
    Event,
    Exchange,
    FIISegment,
    FixedIncome,
    FixedIncomeType,
    InvestmentFund,
    Stock,
    TreasuryBond,
    TreasuryBondType,
)
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.market_data_series import MarketDataSeries
from app.modules.market_data.domain.quote import Quote

STOCK_TYPES = {ASSET_TYPE.STOCK, ASSET_TYPE.BDR}
FII_TYPES = {ASSET_TYPE.FII}
ETF_TYPES = {ASSET_TYPE.ETF, ASSET_TYPE.REIT}
FIXED_INCOME_TYPES = {
    ASSET_TYPE.CDB,
    ASSET_TYPE.DEB,
    ASSET_TYPE.CRI,
    ASSET_TYPE.CRA,
    ASSET_TYPE.LCA,
}
FUND_TYPES = {ASSET_TYPE.FI, ASSET_TYPE.PREV}
TREASURY_TYPES = {ASSET_TYPE.TREASURY}


class AssetService:
    def __init__(
        self,
        uow: UnitOfWork,
        cache: RedisService | None = None,
    ):
        self.uow = uow
        self.cache = cache or RedisService()

    @cached(key_prefix='assets_list', cache=lambda self: self.cache, ttl=86400)
    async def list_assets(self):
        async with self.uow as uow:
            assets = await uow.assets.get(Asset, order_by='ticker')
            return [
                {
                    'id': a.id,
                    'ticker': a.ticker,
                    'name': a.name,
                    'asset_type_id': a.asset_type_id,
                    'asset_type': {
                        'id': a.asset_type.id,
                        'short_name': a.asset_type.short_name,
                        'name': a.asset_type.name,
                        'asset_class_id': a.asset_type.asset_class_id,
                        'asset_class': {
                            'id': a.asset_type.asset_class.id,
                            'name': a.asset_type.asset_class.name,
                        },
                    },
                }
                for a in assets
            ]

    async def delete_asset(self, asset_id: int):
        async with self.uow as uow:
            asset = await uow.assets.get(Asset, id=asset_id)
            if not asset:
                raise NotFoundError('Asset not found')

            references = await uow.portfolios.count_asset_references(asset_id)
            if references:
                raise BusinessRuleError(
                    'Ativo com histórico de carteira não pode ser excluído. '
                    'Altere o ticker mantendo o mesmo ativo.',
                    context={'asset_id': asset_id, 'references': references},
                )

            old_ticker = asset.ticker
            old_asset_type_id = asset.asset_type_id
            await uow.assets.delete(Event, by={'asset_id': asset_id})
            await uow.assets.delete(Quote, by={'asset_id': asset_id})
            await uow.assets.detach_ingestion_attempts(asset_id)
            await self._delete_subclass(uow.assets, asset_id)
            await uow.assets.delete(Asset, asset_id)
            await uow.commit()
        await self._invalidate_asset_cache(
            asset_id=asset_id,
            ticker=old_ticker,
            asset_type_id=old_asset_type_id,
        )
        return {'message': 'OK'}

    async def list_asset_types(self):
        async with self.uow as uow:
            return await uow.assets.get(AssetType)

    async def create_fixed_income(self, fixed_income: dict):
        asset_obj = {
            'ticker': fixed_income.get('ticker'),
            'name': fixed_income.get('name'),
            'asset_type_id': fixed_income.get('asset_type_id'),
        }
        async with self.uow as uow:
            asset_ids = await uow.assets.create(Asset, asset_obj)
            fixed_income_obj = {
                'asset_id': asset_ids[0],
                'maturity_date': fixed_income.get('maturity_date'),
                'fee': fixed_income.get('fee'),
                'index_id': fixed_income.get('index_id'),
                'fixed_income_type_id': fixed_income.get('fixed_income_type_id'),
            }
            await uow.assets.create(FixedIncome, fixed_income_obj)
            await uow.commit()
        await self._invalidate_asset_cache(
            asset_id=asset_ids[0],
            ticker=asset_obj['ticker'],
            asset_type_id=asset_obj['asset_type_id'],
        )
        return {'message': 'OK'}

    async def list_fixed_income_types(self):
        async with self.uow as uow:
            return await uow.assets.get(FixedIncomeType)

    async def list_fii_segments(self):
        async with self.uow as uow:
            return await uow.assets.get(FIISegment)

    async def list_events(self):
        async with self.uow as uow:
            return await uow.assets.get(Event)

    async def create_event(self, event):
        async with self.uow as uow:
            await uow.assets.create(Event, event.model_dump())
            await uow.commit()

    async def update_event(self, event):
        async with self.uow as uow:
            await uow.assets.update(Event, event.model_dump())
            await uow.commit()

    async def delete_event(self, event_id: int):
        async with self.uow as uow:
            await uow.assets.delete(Event, event_id)
            await uow.commit()

    async def get_asset(self, asset_id: int):
        async with self.uow as uow:
            asset = await uow.assets.get(
                Asset,
                id=asset_id,
                relations=['stock', 'fii', 'etf', 'fund', 'fixed_income', 'treasury_bond'],
            )
            if not asset:
                raise NotFoundError('Asset not found')
            return asset

    async def create_asset(self, data: dict):
        asset_type_id = data['asset_type_id']
        asset_obj = {
            'ticker': data.get('ticker'),
            'name': data['name'],
            'asset_type_id': asset_type_id,
            'exchange_id': data.get('exchange_id'),
        }
        async with self.uow as uow:
            asset_ids = await uow.assets.create(Asset, asset_obj)
            asset_id = asset_ids[0]
            await self._create_subclass(uow.assets, asset_type_id, asset_id, data)
            await uow.commit()
        await self._invalidate_asset_cache(
            asset_id=asset_id,
            ticker=asset_obj['ticker'],
            asset_type_id=asset_type_id,
        )
        return {'message': 'OK', 'id': asset_id}

    async def update_asset(self, data: dict):
        asset_id = data['id']
        asset_type_id = data['asset_type_id']

        async with self.uow as uow:
            asset = await uow.assets.get(Asset, id=asset_id)
            if not asset:
                raise NotFoundError('Asset not found')

            old_ticker = asset.ticker
            old_asset_type_id = asset.asset_type_id
            asset.ticker = data.get('ticker')
            asset.name = data['name']
            asset.asset_type_id = asset_type_id
            asset.exchange_id = data.get('exchange_id')
            await self._delete_subclass(uow.assets, asset_id)
            await self._create_subclass(
                uow.assets,
                asset_type_id,
                asset_id,
                data,
            )
            await uow.commit()
        await self._invalidate_asset_cache(
            asset_id=asset_id,
            ticker=old_ticker,
            asset_type_id=old_asset_type_id,
        )
        await self._invalidate_asset_cache(
            asset_id=asset_id,
            ticker=asset.ticker,
            asset_type_id=asset.asset_type_id,
        )
        return {'message': 'OK'}

    async def _invalidate_asset_cache(
        self,
        *,
        asset_id: int,
        ticker: str | None,
        asset_type_id: int,
    ) -> None:
        keys = {
            'assets_list::',
            f'market_data:asset:id:{asset_id}',
        }
        if ticker:
            keys.add(f'market_data:asset:ticker:{asset_type_id}:{ticker.strip().upper()}')
        for key in keys:
            try:
                await self.cache.delete(key)
            except Exception as exc:
                logger.warning('Asset cache invalidation failed for %s: %s', key, exc)

    @staticmethod
    async def _create_subclass(
        repository: SQLAlchemyRepository,
        asset_type_id: int,
        asset_id: int,
        data: dict,
    ):
        if asset_type_id in STOCK_TYPES:
            await repository.create(
                Stock,
                {
                    'asset_id': asset_id,
                    'country': data.get('country'),
                    'sector': data.get('sector'),
                    'industry': data.get('industry'),
                },
            )
        elif asset_type_id in FII_TYPES:
            if data.get('fii_segment_id'):
                await repository.create(
                    FII,
                    {
                        'asset_id': asset_id,
                        'segment_id': data['fii_segment_id'],
                    },
                )
        elif asset_type_id in ETF_TYPES:
            await repository.create(
                ETF,
                {
                    'asset_id': asset_id,
                    'segment_id': data.get('etf_segment_id'),
                },
            )
        elif asset_type_id in FIXED_INCOME_TYPES:
            await repository.create(
                FixedIncome,
                {
                    'asset_id': asset_id,
                    'maturity_date': data.get('maturity_date'),
                    'fee': data.get('fee'),
                    'index_id': data.get('index_id'),
                    'fixed_income_type_id': data.get('fixed_income_type_id'),
                },
            )
        elif asset_type_id in FUND_TYPES:
            await repository.create(
                InvestmentFund,
                {
                    'asset_id': asset_id,
                    'legal_id': data.get('legal_id'),
                    'anbima_code': data.get('anbima_code'),
                    'anbima_code_class': data.get('anbima_code_class'),
                    'anbima_category': data.get('anbima_category'),
                },
            )
        elif asset_type_id in TREASURY_TYPES and data.get('treasury_bond_type_id'):
            await repository.create(
                TreasuryBond,
                {
                    'asset_id': asset_id,
                    'maturity_date': data.get('maturity_date'),
                    'fee': data.get('fee'),
                    'type_id': data['treasury_bond_type_id'],
                },
            )

    @staticmethod
    async def _delete_subclass(
        repository: SQLAlchemyRepository,
        asset_id: int,
    ):
        for model in [Stock, FII, ETF, FixedIncome, InvestmentFund]:
            with contextlib.suppress(Exception):
                await repository.delete(model, by={'asset_id': asset_id})
        with contextlib.suppress(Exception):
            await repository.delete(TreasuryBond, by={'asset_id': asset_id})

    async def record_visit(self, user_id: int, asset_id: int) -> None:
        async with self.uow as uow:
            asset = await uow.assets.get(Asset, id=asset_id)
            if not asset:
                raise NotFoundError('Asset not found')
            await uow.assets.record_asset_visit(user_id, asset_id)
            await uow.commit()

    async def list_favorite_assets(self, user_id: int, limit: int = 8) -> list[dict]:
        """Assets the user opens most, as a shortcut back to them."""
        async with self.uow as uow:
            rows = await uow.assets.get_most_visited_assets(user_id, limit)
            return [
                {
                    'id': asset.id,
                    'ticker': asset.ticker,
                    'name': asset.name,
                    'asset_type_id': asset.asset_type_id,
                    'asset_type': {
                        'id': asset.asset_type.id,
                        'short_name': asset.asset_type.short_name,
                        'name': asset.asset_type.name,
                    },
                    'visit_count': visit_count,
                    'last_visited_at': last_visited_at,
                }
                for asset, visit_count, last_visited_at in rows
            ]

    async def list_exchanges(self):
        async with self.uow as uow:
            return await uow.assets.get(Exchange)

    async def list_etf_segments(self):
        async with self.uow as uow:
            return await uow.assets.get(ETFSegment)

    async def list_treasury_bond_types(self):
        async with self.uow as uow:
            return await uow.assets.get(TreasuryBondType)

    async def list_market_data_series(self):
        async with self.uow as uow:
            return await uow.assets.get(MarketDataSeries)
