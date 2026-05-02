# app/modules/asset/service/asset_service.py
"""
Asset service - handles asset management operations.
"""

from app.core.exceptions import NotFoundError
from app.infra.db.models.asset import Asset, AssetType, Event, Exchange
from app.infra.db.models.asset_etf import ETF, ETFSegment
from app.infra.db.models.asset_fii import FII, FIISegment
from app.infra.db.models.asset_fixed_income import FixedIncome, FixedIncomeType
from app.infra.db.models.asset_investment_fund import InvestmentFund
from app.infra.db.models.asset_stock import Stock
from app.infra.db.models.asset_treasury_bond import TreasuryBond, TreasuryBondType
from app.infra.db.models.constants.asset_type import ASSET_TYPE
from app.infra.db.models.market_data import Index
from app.infra.db.models.portfolio import Transaction
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService

STOCK_TYPES = {ASSET_TYPE.STOCK, ASSET_TYPE.BDR}
FII_TYPES = {ASSET_TYPE.FII}
ETF_TYPES = {ASSET_TYPE.ETF, ASSET_TYPE.REIT}
FIXED_INCOME_TYPES = {ASSET_TYPE.CDB, ASSET_TYPE.DEB, ASSET_TYPE.CRI, ASSET_TYPE.CRA, ASSET_TYPE.LCA}
FUND_TYPES = {ASSET_TYPE.FI, ASSET_TYPE.PREV}
TREASURY_TYPES = {ASSET_TYPE.TREASURY}


class AssetService:
    def __init__(self, session):
        self.session = session
        self.repo = SQLAlchemyRepository(session)
        self.cache = RedisService()

    @cached(key_prefix="assets_list", cache=lambda self: self.cache, ttl=86400)
    async def list_assets(self):
        assets = await self.repo.get(Asset, order_by='ticker')
        return [
            {
                "id": a.id,
                "ticker": a.ticker,
                "name": a.name,
                "asset_type_id": a.asset_type_id,
                "asset_type": {
                    "id": a.asset_type.id,
                    "short_name": a.asset_type.short_name,
                    "name": a.asset_type.name,
                    "asset_class_id": a.asset_type.asset_class_id,
                    "asset_class": {
                        "id": a.asset_type.asset_class.id,
                        "name": a.asset_type.asset_class.name,
                    },
                },
            }
            for a in assets
        ]

    async def delete_asset(self, asset_id: int):
        await self.repo.delete(FixedIncome, by={"asset_id": asset_id})
        await self.repo.delete(Transaction, by={"asset_id": asset_id})
        await self.repo.delete(Asset, asset_id)
        
        await self.session.commit()
        return {'message': 'OK'}

    async def list_asset_types(self):
        asset_types = await self.repo.get(AssetType)
        return asset_types

    async def create_fixed_income(self, fixed_income: dict):
        asset_obj = {
            "ticker": fixed_income.get('ticker'),
            "name": fixed_income.get('name'),
            "asset_type_id": fixed_income.get('asset_type_id'),
        }
        asset_ids = await self.repo.create(Asset, asset_obj)
        
        fixed_income_obj = {
            "asset_id": asset_ids[0],
            "maturity_date": fixed_income.get('maturity_date'),
            "fee": fixed_income.get('fee'),
            "index_id": fixed_income.get('index_id'),
            "fixed_income_type_id": fixed_income.get('fixed_income_type_id'),
        }
        await self.repo.create(FixedIncome, fixed_income_obj)
        
        await self.session.commit()
        return {'message': 'OK'}

    async def list_fixed_income_types(self):
        fixed_income_types = await self.repo.get(FixedIncomeType)
        return fixed_income_types

    async def list_fii_segments(self):
        fii_segments = await self.repo.get(FIISegment)
        return fii_segments

    async def list_events(self):
        events = await self.repo.get(Event)
        return events

    async def create_event(self, event):
        await self.repo.create(Event, event.model_dump())
        await self.session.commit()

    async def update_event(self, event):
        await self.repo.update(Event, event.model_dump())
        await self.session.commit()

    async def delete_event(self, event_id: int):
        await self.repo.delete(Event, event_id)
        await self.session.commit()

    async def get_asset(self, asset_id: int):
        asset = await self.repo.get(
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
        asset_ids = await self.repo.create(Asset, asset_obj)
        asset_id = asset_ids[0]

        await self._create_subclass(asset_type_id, asset_id, data)
        await self.session.commit()
        return {'message': 'OK', 'id': asset_id}

    async def update_asset(self, data: dict):
        asset_id = data['id']
        asset_type_id = data['asset_type_id']

        asset = await self.repo.get(Asset, id=asset_id)
        if not asset:
            raise NotFoundError('Asset not found')

        asset.ticker = data.get('ticker')
        asset.name = data['name']
        asset.asset_type_id = asset_type_id
        asset.exchange_id = data.get('exchange_id')

        # Delete old subclass rows then recreate
        await self._delete_subclass(asset_id)
        await self._create_subclass(asset_type_id, asset_id, data)

        await self.session.commit()
        return {'message': 'OK'}

    async def _create_subclass(self, asset_type_id: int, asset_id: int, data: dict):
        if asset_type_id in STOCK_TYPES:
            await self.repo.create(Stock, {
                'asset_id': asset_id,
                'country': data.get('country'),
                'sector': data.get('sector'),
                'industry': data.get('industry'),
            })
        elif asset_type_id in FII_TYPES:
            if data.get('fii_segment_id'):
                await self.repo.create(FII, {
                    'asset_id': asset_id,
                    'segment_id': data['fii_segment_id'],
                })
        elif asset_type_id in ETF_TYPES:
            await self.repo.create(ETF, {
                'asset_id': asset_id,
                'segment_id': data.get('etf_segment_id'),
            })
        elif asset_type_id in FIXED_INCOME_TYPES:
            await self.repo.create(FixedIncome, {
                'asset_id': asset_id,
                'maturity_date': data.get('maturity_date'),
                'fee': data.get('fee'),
                'index_id': data.get('index_id'),
                'fixed_income_type_id': data.get('fixed_income_type_id'),
            })
        elif asset_type_id in FUND_TYPES:
            await self.repo.create(InvestmentFund, {
                'asset_id': asset_id,
                'legal_id': data.get('legal_id'),
                'anbima_code': data.get('anbima_code'),
                'anbima_code_class': data.get('anbima_code_class'),
                'anbima_category': data.get('anbima_category'),
            })
        elif asset_type_id in TREASURY_TYPES:
            if data.get('treasury_bond_type_id'):
                await self.repo.create(TreasuryBond, {
                    'asset_id': asset_id,
                    'maturity_date': data.get('maturity_date'),
                    'fee': data.get('fee'),
                    'type_id': data['treasury_bond_type_id'],
                })

    async def _delete_subclass(self, asset_id: int):
        for model in [Stock, FII, ETF, FixedIncome, InvestmentFund]:
            try:
                await self.repo.delete(model, by={'asset_id': asset_id})
            except Exception:
                pass
        try:
            await self.repo.delete(TreasuryBond, by={'asset_id': asset_id})
        except Exception:
            pass

    async def list_exchanges(self):
        return await self.repo.get(Exchange)

    async def list_etf_segments(self):
        return await self.repo.get(ETFSegment)

    async def list_treasury_bond_types(self):
        return await self.repo.get(TreasuryBondType)

    async def list_indexes(self):
        return await self.repo.get(Index)
