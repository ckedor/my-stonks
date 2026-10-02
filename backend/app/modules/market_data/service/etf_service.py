"""The market page of an ETF: what it is, as registered, and what it holds.

Read from storage, never from a provider: the registry is written weekly and
the holdings by their own routine, so a page read costs two selects and no
network. What the storage cannot have — the holdings of a UCITS fund whose
manager's file is not read, since no regulator publishes them — is said so,
not fetched on the fly.
"""

from app.core.exceptions import NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.domain.assets import Asset
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.etf_registry import EtfHoldingSource, holdings_source


def _entity(institution) -> dict | None:
    if institution is None:
        return None
    return {
        'name': institution.name,
        'lei': institution.lei,
        'cnpj': institution.cnpj,
        'country': institution.country,
    }


class EtfReadService:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def _require_etf(self, uow, asset_id: int):
        asset = await uow.assets.get(Asset, id=asset_id)
        if asset is None or asset.asset_type_id != int(ASSET_TYPE.ETF):
            raise NotFoundError('ETF not found', context={'asset_id': asset_id})
        return await uow.etf_registry.get_etf(asset_id)

    async def get_profile(self, *, asset_id: int) -> dict:
        async with self.uow as uow:
            etf = await self._require_etf(uow, asset_id)
            profile: dict = {
                'registry': None,
                'fund': None,
                'share_class': None,
                'cvm_fund': None,
                'holdings': None,
                'holdings_available': False,
            }
            if etf is None:
                return profile

            if etf.registry_fund is not None:
                fund = etf.registry_fund
                profile['registry'] = 'cvm'
                profile['cvm_fund'] = {
                    'cnpj': fund.cnpj,
                    'name': fund.name,
                    'status': fund.status,
                    'started_at': fund.started_at,
                    'administrator_name': fund.administrator_name,
                    'manager_name': fund.manager_name,
                }
                return profile

            share_class = etf.registry_class
            if share_class is None:
                return profile
            fund = share_class.fund
            manager_ids = await uow.etf_registry.get_manager_ids(fund.id)
            institutions = await uow.etf_registry.get_institutions([
                *manager_ids,
                *([fund.umbrella_institution_id] if fund.umbrella_institution_id else []),
            ])
            report = await uow.etf_registry.latest_holding_report(fund.id)

        profile['registry'] = fund.source
        profile['fund'] = {
            'name': fund.name,
            'lei': fund.lei,
            'sec_series_id': fund.sec_series_id,
            'domicile': fund.domicile,
            'status': fund.status,
            'tracks_index': fund.tracks_index,
            'leveraged_or_inverse': fund.leveraged_or_inverse,
            'fund_of_funds': fund.fund_of_funds,
            'umbrella': _entity(institutions.get(fund.umbrella_institution_id)),
            'managers': [
                _entity(institutions[manager]) for manager in manager_ids if manager in institutions
            ],
        }
        profile['share_class'] = {
            'name': share_class.name,
            'ticker': share_class.ticker,
            'isin': share_class.isin,
            'sec_class_id': share_class.sec_class_id,
            'currency': share_class.currency,
            'distribution_policy': share_class.distribution_policy,
            'cfi_code': share_class.cfi_code,
            'status': share_class.status,
        }
        profile['holdings_available'] = holdings_source(fund, share_class.isin) is not None
        if report is not None:
            profile['holdings'] = {
                'report_date': report.report_date,
                'source': report.source,
                'net_assets': report.net_assets,
                'total_assets': report.total_assets,
                'holdings_count': report.holdings_count,
                'fetched_at': report.fetched_at,
            }
        return profile

    async def get_holdings(self, *, asset_id: int, page: int, page_size: int) -> dict:
        """One page of the latest report, largest position first."""
        async with self.uow as uow:
            etf = await self._require_etf(uow, asset_id)
            share_class = etf.registry_class if etf is not None else None
            report = (
                await uow.etf_registry.latest_holding_report(share_class.etf_registry_id)
                if share_class is not None
                else None
            )
            if report is None:
                return {
                    'report_date': None,
                    'source': None,
                    'total': 0,
                    'page': page,
                    'page_size': page_size,
                    'items': [],
                }
            offset = (page - 1) * page_size
            holdings = await uow.etf_registry.holdings_page(
                report.id, offset=offset, limit=page_size
            )
        return {
            'report_date': report.report_date,
            'source': report.source or EtfHoldingSource.SEC_NPORT,
            'total': report.holdings_count,
            'page': page,
            'page_size': page_size,
            'items': [
                {
                    'rank': offset + index + 1,
                    'name': holding.name,
                    'isin': holding.isin,
                    'ticker': holding.ticker,
                    'asset_id': holding.asset_id,
                    'asset_category': holding.asset_category,
                    'country': holding.country,
                    'currency': holding.currency,
                    'balance': holding.balance,
                    'units': holding.units,
                    'value_usd': holding.value_usd,
                    'weight': holding.weight,
                }
                for index, holding in enumerate(holdings)
            ],
        }
