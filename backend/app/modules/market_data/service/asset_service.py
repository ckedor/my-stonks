# app/modules/asset/service/asset_service.py
"""
Asset service - handles asset management operations.
"""

import contextlib

from app.config.logger import logger
from app.core.exceptions import (
    AlreadyExistsError,
    BusinessRuleError,
    NotFoundError,
    ValidationError,
)
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
from app.modules.market_data.domain.fund_registry import (
    FundShareSeries,
    FundShareSeriesAlias,
    normalize_series_label,
)
from app.modules.market_data.domain.fund_share_value import (
    ShareValueDataset,
    UnsupportedFundKind,
    share_value_dataset,
)
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

ASSETS_LIST_CACHE_PREFIX = 'assets_list'
TREASURY_TYPES = {ASSET_TYPE.TREASURY}

#: The columns of ``asset.fund`` that say which priced unit the asset is. The
#: generic asset form knows nothing about them, so an edit keeps them as they are.
FUND_REGISTRY_LINK = (
    'fund_registry_class_id',
    'fund_registry_subclass_id',
    'fund_share_series_id',
    'selection_version',
)


class AssetService:
    def __init__(
        self,
        uow: UnitOfWork,
        cache: RedisService | None = None,
    ):
        self.uow = uow
        self.cache = cache or RedisService()

    @cached(key_prefix=ASSETS_LIST_CACHE_PREFIX, cache=lambda self: self.cache, ttl=86400)
    async def list_assets(self):
        async with self.uow as uow:
            assets = await uow.assets.get(Asset, order_by='ticker')
            return [
                {
                    'id': a.id,
                    'ticker': a.ticker,
                    'name': a.name,
                    'logo_url': a.logo_url,
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
            if asset.fund is not None:
                # Loads the registry class onto the same fund instance, so its
                # classification is readable after the session closes.
                await uow.fund_registry.get_funds([asset.id])
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
            if asset_type_id in FUND_TYPES:
                link = await uow.fund_registry.get_fund_link(asset_id, FUND_REGISTRY_LINK)
                data = {**data, **(link or {})}
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

    async def register_fund(  # noqa: PLR0913 - one choice per level of the priced unit
        self,
        *,
        fund_registry_class_id: int,
        asset_type_id: int,
        fund_registry_subclass_id: int | None = None,
        series_id: int | None = None,
        series_label: str | None = None,
        name: str | None = None,
    ) -> dict:
        """Make one priced unit of a registered class an asset.

        The unit is the class, narrowed to a subclass, or — for a FIDC — to a
        series. A series is chosen either by its id or by the label it was
        filed under; a label resolves to the series already confirmed for it,
        or becomes a new series whose first alias is that label.
        """
        if asset_type_id not in FUND_TYPES:
            raise ValidationError('A registered fund is an FI or PREV asset')
        if series_id is not None and series_label is not None:
            raise ValidationError('Choose the series by id or by label, not both')
        async with self.uow as uow:
            registry = uow.fund_registry
            # Serialize registrations of the same class: two users confirming
            # it concurrently must receive the same priced unit.
            registry_class = await registry.get_class(fund_registry_class_id, for_update=True)
            if registry_class is None:
                raise NotFoundError(
                    'Fund registry class not found', context={'id': fund_registry_class_id}
                )
            subclass = None
            if fund_registry_subclass_id is not None:
                subclass = await registry.get_subclass(fund_registry_subclass_id)
                if subclass is None or subclass.fund_registry_class_id != registry_class.id:
                    raise ValidationError('The subclass does not belong to the chosen class')
            wants_series = series_id is not None or series_label is not None
            if (
                self._dataset_of(registry_class) == ShareValueDataset.FIDC_MONTHLY
                and not wants_series
            ):
                raise ValidationError('Choose and confirm the series of this FIDC')
            if wants_series and self._dataset_of(registry_class) != ShareValueDataset.FIDC_MONTHLY:
                raise ValidationError('Only a FIDC class files share values by series')

            series = None
            if series_id is not None:
                series = await registry.get_series(series_id)
                if series is None or series.fund_registry_class_id != registry_class.id:
                    raise ValidationError('The series does not belong to the chosen class')
            elif series_label is not None:
                series = await self._series_for_label(registry, registry_class.id, series_label)

            resolved_series_id = series.id if series is not None else None
            existing = await registry.find_priced_unit(
                class_id=registry_class.id,
                subclass_id=fund_registry_subclass_id,
                series_id=resolved_series_id,
            )
            if existing is not None:
                return {'message': 'OK', 'id': existing.asset_id}
            asset_name = name or (subclass.name if subclass else registry_class.name)
            if series is not None and not name:
                asset_name = f'{asset_name} - {series.name}'
            asset_ids = await uow.assets.create(
                Asset,
                {'ticker': None, 'name': asset_name[:200], 'asset_type_id': asset_type_id},
            )
            await uow.assets.create(
                InvestmentFund,
                {
                    'asset_id': asset_ids[0],
                    'legal_id': registry_class.cnpj,
                    'fund_registry_class_id': registry_class.id,
                    'fund_registry_subclass_id': fund_registry_subclass_id,
                    'fund_share_series_id': resolved_series_id,
                },
            )
            await uow.commit()
        await self._invalidate_asset_cache(
            asset_id=asset_ids[0], ticker=None, asset_type_id=asset_type_id
        )
        return {'message': 'OK', 'id': asset_ids[0]}

    async def select_fund_series(
        self, asset_id: int, *, series_id: int | None = None, series_label: str | None = None
    ) -> dict:
        """Confirm a stable series for a legacy linked FIDC that has none.

        Existing transactions keep their asset. Old automatic selections are
        no longer covered and will be reconciled on the next ingestion.
        """
        if (series_id is None) == (series_label is None):
            raise ValidationError('Choose the series by id or by label')
        async with self.uow as uow:
            registry = uow.fund_registry
            funds = await registry.get_funds([asset_id])
            if not funds or funds[0].fund_registry_class_id is None:
                raise ValidationError('Link this fund to a registry class before choosing a series')
            fund = funds[0]
            registry_class = await registry.get_class(fund.fund_registry_class_id, for_update=True)
            if self._dataset_of(registry_class) != ShareValueDataset.FIDC_MONTHLY:
                raise ValidationError('Only a FIDC class files share values by series')
            if fund.fund_share_series_id is not None:
                raise ValidationError('This asset already has a confirmed series')
            series = (
                await registry.get_series(series_id)
                if series_id is not None
                else await self._series_for_label(registry, registry_class.id, series_label)
            )
            if series is None or series.fund_registry_class_id != registry_class.id:
                raise ValidationError('The series does not belong to the chosen class')
            if await registry.find_priced_unit(
                class_id=registry_class.id,
                subclass_id=fund.fund_registry_subclass_id,
                series_id=series.id,
            ):
                raise AlreadyExistsError('This series is already registered as another asset')
            fund.fund_share_series_id = series.id
            fund.selection_version += 1
            await uow.commit()
        await self._invalidate_asset_cache(
            asset_id=asset_id, ticker=fund.asset.ticker, asset_type_id=fund.asset.asset_type_id
        )
        return {'message': 'OK', 'id': asset_id}

    @staticmethod
    def _dataset_of(registry_class) -> ShareValueDataset | None:
        try:
            return share_value_dataset(registry_class.fund.kind if registry_class.fund else None)
        except UnsupportedFundKind:
            return None

    @staticmethod
    async def _series_for_label(registry, class_id: int, label: str) -> FundShareSeries:
        normalized = normalize_series_label(label)
        if not normalized:
            raise ValidationError('A series label cannot be empty')
        for alias in await registry.list_aliases([class_id]):
            if alias.label == normalized:
                if alias.valid_from is None and alias.valid_to is None:
                    return await registry.get_series(alias.fund_share_series_id)
                raise ValidationError(
                    'This label already means a series for part of its history; '
                    'choose that series by id',
                    context={'series_id': alias.fund_share_series_id},
                )
        created = await registry.create(
            FundShareSeries, {'fund_registry_class_id': class_id, 'name': label.strip()[:100]}
        )
        await registry.create(
            FundShareSeriesAlias,
            {
                'fund_share_series_id': created[0],
                'fund_registry_class_id': class_id,
                'label': normalized,
            },
        )
        return await registry.get_series(created[0])

    async def confirm_series_aliases(self, asset_id: int, aliases: list[dict]):
        """Confirm which filing labels meant the asset's series, and when.

        Earlier aliases are kept, so a replay of old files still resolves. An
        alias identical to one already confirmed is a no-op. A label that would
        mean two things on the same date is refused. Every asset priced by the
        series gets a new selection version: what was applied under the old
        aliases is no longer covered, and the next share-value run re-reads it.
        """
        async with self.uow as uow:
            registry = uow.fund_registry
            funds = await registry.get_funds([asset_id])
            if not funds:
                raise NotFoundError('Investment fund not found', context={'asset_id': asset_id})
            fund = funds[0]
            if fund.fund_share_series_id is None:
                raise ValidationError('This asset is not priced by a series of shares')
            class_id = fund.fund_registry_class_id
            existing = await registry.list_aliases([class_id])
            added = []
            for item in aliases:
                candidate = FundShareSeriesAlias(
                    fund_share_series_id=fund.fund_share_series_id,
                    fund_registry_class_id=class_id,
                    label=normalize_series_label(item['label']),
                    valid_from=item.get('valid_from'),
                    valid_to=item.get('valid_to'),
                )
                if not candidate.label:
                    raise ValidationError('A series label cannot be empty')
                if (
                    candidate.valid_from
                    and candidate.valid_to
                    and candidate.valid_from > candidate.valid_to
                ):
                    raise ValidationError('An alias cannot end before it starts')
                same_label = [
                    alias for alias in [*existing, *added] if alias.label == candidate.label
                ]
                if any(
                    alias.fund_share_series_id == candidate.fund_share_series_id
                    and (alias.valid_from, alias.valid_to)
                    == (candidate.valid_from, candidate.valid_to)
                    for alias in same_label
                ):
                    continue
                clash = next((alias for alias in same_label if alias.overlaps(candidate)), None)
                if clash is not None:
                    raise ValidationError(
                        f'"{item["label"]}" is already confirmed for dates that overlap',
                        context={
                            'series_id': clash.fund_share_series_id,
                            'valid_from': str(clash.valid_from),
                            'valid_to': str(clash.valid_to),
                        },
                    )
                added.append(candidate)
            if added:
                await registry.create(
                    FundShareSeriesAlias,
                    [
                        {
                            'fund_share_series_id': alias.fund_share_series_id,
                            'fund_registry_class_id': alias.fund_registry_class_id,
                            'label': alias.label,
                            'valid_from': alias.valid_from,
                            'valid_to': alias.valid_to,
                        }
                        for alias in added
                    ],
                )
                affected = await registry.get_series_asset_ids(fund.fund_share_series_id)
                await registry.bump_selection_version(affected)
                await uow.commit()
            return [
                alias
                for alias in await registry.list_aliases([class_id])
                if alias.fund_share_series_id == fund.fund_share_series_id
            ]

    async def _invalidate_asset_cache(
        self,
        *,
        asset_id: int,
        ticker: str | None,
        asset_type_id: int,
    ) -> None:
        # Por prefixo, e não pela chave literal que o decorator monta: escrever
        # 'assets_list::' aqui acopla esta função ao formato de chave do
        # decorator, e a invalidação deixa de casar em silêncio quando ele muda.
        try:
            await self.cache.delete_prefix(f'{ASSETS_LIST_CACHE_PREFIX}:')
        except Exception as exc:
            logger.warning('Asset list cache invalidation failed: %s', exc)

        keys = {f'market_data:asset:id:{asset_id}'}
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
                    'anbima_category': data.get('anbima_category'),
                    **{
                        column: data[column]
                        for column in FUND_REGISTRY_LINK
                        if data.get(column) is not None
                    },
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

    async def list_favorite_assets(
        self,
        user_id: int,
        limit: int = 8,
        asset_type_id: int | None = None,
        asset_ids: list[int] | None = None,
        brazilian: bool | None = None,
    ) -> list[dict]:
        """Assets the user opens most, as a shortcut back to them."""
        async with self.uow as uow:
            rows = await uow.assets.get_most_visited_assets(
                user_id,
                limit,
                asset_type_id=asset_type_id,
                asset_ids=asset_ids,
                brazilian=brazilian,
            )
            return [
                {
                    'id': asset.id,
                    'ticker': asset.ticker,
                    'name': asset.name,
                    'asset_type_id': asset.asset_type_id,
                    'logo_url': asset.logo_url,
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
