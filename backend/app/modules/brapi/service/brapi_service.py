"""Service layer for the brapi integration."""

# The upstream API legitimately exposes endpoints with many query parameters.
# ruff: noqa: PLR0913, PLR0917

from collections.abc import AsyncIterator
from typing import Any

from app.infra.integrations.brapi_client import BrapiClient


class BrapiService:  # noqa: PLR0904 - mirrors the public brapi API
    def __init__(self, client: BrapiClient | None = None):
        self.client = client or BrapiClient()

    async def aclose(self) -> None:
        await self.client.aclose()

    async def get_crypto(
        self,
        coin: str | None = None,
        currency: str | None = None,
        range: str | None = None,
        interval: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_crypto(
            coin=coin,
            currency=currency,
            range=range,
            interval=interval,
        )

    async def get_crypto_available(
        self,
        search: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_crypto_available(
            search=search,
        )

    async def get_currency(
        self,
        currency: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_currency(
            currency=currency,
        )

    async def get_currency_historical(
        self,
        currency: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_order: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_currency_historical(
            currency=currency,
            startDate=start_date,
            endDate=end_date,
            sortOrder=sort_order,
            limit=limit,
        )

    async def get_currency_available(
        self,
        search: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_currency_available(
            search=search,
        )

    async def get_dictionary(
        self,
        search: str | None = None,
        category: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_dictionary(
            search=search,
            category=category,
        )

    async def list_fiis(
        self,
        page: int | None = 1,
        limit: int | None = 20,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
        symbols: str | None = None,
        cnpjs: str | None = None,
        search: str | None = None,
        segment_type: str | None = None,
        segmento_atuacao: str | None = None,
        mandate: str | None = None,
        tipo_gestao: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.list_fiis(
            page=page,
            limit=limit,
            sortBy=sort_by,
            sortOrder=sort_order,
            symbols=symbols,
            cnpjs=cnpjs,
            search=search,
            segmentType=segment_type,
            segmentoAtuacao=segmento_atuacao,
            mandate=mandate,
            tipoGestao=tipo_gestao,
        )

    async def get_fii_indicators(
        self,
        symbols: str,
    ) -> dict[str, Any]:
        return await self.client.get_fii_indicators(
            symbols=symbols,
        )

    async def get_fii_indicators_history(
        self,
        symbols: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_fii_indicators_history(
            symbols=symbols,
            startDate=start_date,
            endDate=end_date,
            sortBy=sort_by,
            sortOrder=sort_order,
        )

    async def get_fii_historical(
        self,
        symbols: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_fii_historical(
            symbols=symbols,
            startDate=start_date,
            endDate=end_date,
            sortOrder=sort_order,
        )

    async def get_fii_portfolio(
        self,
        symbols: str,
        reference_date: str | None = None,
        include: str | None = None,
        all_versions: str | None = 'false',
    ) -> dict[str, Any]:
        return await self.client.get_fii_portfolio(
            symbols=symbols,
            referenceDate=reference_date,
            include=include,
            allVersions=all_versions,
        )

    async def get_fii_properties(
        self,
        symbols: str,
        reference_date: str | None = None,
        sort_by: str | None = 'revenueShare',
        sort_order: str | None = 'desc',
        all_versions: str | None = 'false',
    ) -> dict[str, Any]:
        return await self.client.get_fii_properties(
            symbols=symbols,
            referenceDate=reference_date,
            sortBy=sort_by,
            sortOrder=sort_order,
            allVersions=all_versions,
        )

    async def get_fii_properties_history(
        self,
        symbols: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
        all_versions: str | None = 'false',
    ) -> dict[str, Any]:
        return await self.client.get_fii_properties_history(
            symbols=symbols,
            startDate=start_date,
            endDate=end_date,
            sortBy=sort_by,
            sortOrder=sort_order,
            allVersions=all_versions,
        )

    async def get_fii_portfolio_history(
        self,
        symbols: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
        all_versions: str | None = 'false',
    ) -> dict[str, Any]:
        return await self.client.get_fii_portfolio_history(
            symbols=symbols,
            startDate=start_date,
            endDate=end_date,
            sortBy=sort_by,
            sortOrder=sort_order,
            allVersions=all_versions,
        )

    async def get_fii_reports(
        self,
        symbols: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
        page: int | None = 1,
        limit: int | None = 20,
        all_versions: str | None = 'false',
    ) -> dict[str, Any]:
        return await self.client.get_fii_reports(
            symbols=symbols,
            startDate=start_date,
            endDate=end_date,
            sortBy=sort_by,
            sortOrder=sort_order,
            page=page,
            limit=limit,
            allVersions=all_versions,
        )

    async def get_fii_dividends(
        self,
        symbols: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_fii_dividends(
            symbols=symbols,
            startDate=start_date,
            endDate=end_date,
            sortBy=sort_by,
            sortOrder=sort_order,
        )

    async def get_fii_financials(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        year: int | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
        page: int | None = 1,
        limit: int | None = 20,
    ) -> dict[str, Any]:
        return await self.client.get_fii_financials(
            symbols=symbols,
            cnpjs=cnpjs,
            year=year,
            startDate=start_date,
            endDate=end_date,
            sortBy=sort_by,
            sortOrder=sort_order,
            page=page,
            limit=limit,
        )

    async def get_fii_annual_reports(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        year: int | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
        page: int | None = 1,
        limit: int | None = 20,
        include: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_fii_annual_reports(
            symbols=symbols,
            cnpjs=cnpjs,
            year=year,
            startDate=start_date,
            endDate=end_date,
            sortBy=sort_by,
            sortOrder=sort_order,
            page=page,
            limit=limit,
            include=include,
        )

    async def list_funds(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        page: int | None = 1,
        limit: int | None = 20,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
        search: str | None = None,
        asset_type: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.list_funds(
            symbols=symbols,
            cnpjs=cnpjs,
            page=page,
            limit=limit,
            sortBy=sort_by,
            sortOrder=sort_order,
            search=search,
            assetType=asset_type,
            status=status,
        )

    async def get_fund_indicators(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        asset_type: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_fund_indicators(
            symbols=symbols,
            cnpjs=cnpjs,
            assetType=asset_type,
        )

    async def get_fund_nav_history(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        page: int | None = 1,
        limit: int | None = 20,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_fund_nav_history(
            symbols=symbols,
            cnpjs=cnpjs,
            startDate=start_date,
            endDate=end_date,
            page=page,
            limit=limit,
            sortOrder=sort_order,
        )

    async def get_fund_profile(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        reference_date: str | None = None,
        include: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_fund_profile(
            symbols=symbols,
            cnpjs=cnpjs,
            startDate=start_date,
            endDate=end_date,
            referenceDate=reference_date,
            include=include,
        )

    async def get_fund_dividends(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        page: int | None = 1,
        limit: int | None = 20,
        sort_by: str | None = 'paymentDate',
        sort_order: str | None = 'desc',
        asset_type: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_fund_dividends(
            symbols=symbols,
            cnpjs=cnpjs,
            startDate=start_date,
            endDate=end_date,
            page=page,
            limit=limit,
            sortBy=sort_by,
            sortOrder=sort_order,
            assetType=asset_type,
        )

    async def get_fiagro_reports(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        page: int | None = 1,
        limit: int | None = 20,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
        all_versions: bool | None = False,
    ) -> dict[str, Any]:
        return await self.client.get_fiagro_reports(
            symbols=symbols,
            cnpjs=cnpjs,
            startDate=start_date,
            endDate=end_date,
            page=page,
            limit=limit,
            sortBy=sort_by,
            sortOrder=sort_order,
            allVersions=all_versions,
        )

    async def get_fiagro_portfolio(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        reference_date: str | None = None,
        all_versions: bool | None = False,
        include: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_fiagro_portfolio(
            symbols=symbols,
            cnpjs=cnpjs,
            referenceDate=reference_date,
            allVersions=all_versions,
            include=include,
        )

    async def get_fund_portfolio(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        page: int | None = 1,
        limit: int | None = 20,
        reference_date: str | None = None,
        include: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_fund_portfolio(
            symbols=symbols,
            cnpjs=cnpjs,
            page=page,
            limit=limit,
            referenceDate=reference_date,
            include=include,
        )

    async def get_fidc_reports(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        page: int | None = 1,
        limit: int | None = 20,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_fidc_reports(
            symbols=symbols,
            cnpjs=cnpjs,
            startDate=start_date,
            endDate=end_date,
            page=page,
            limit=limit,
            sortBy=sort_by,
            sortOrder=sort_order,
        )

    async def get_fidc_portfolio(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        reference_date: str | None = None,
        include: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_fidc_portfolio(
            symbols=symbols,
            cnpjs=cnpjs,
            referenceDate=reference_date,
            include=include,
        )

    async def get_fip_reports(
        self,
        symbols: str | None = None,
        cnpjs: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        page: int | None = 1,
        limit: int | None = 20,
        sort_by: str | None = None,
        sort_order: str | None = 'desc',
        report_type: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_fip_reports(
            symbols=symbols,
            cnpjs=cnpjs,
            startDate=start_date,
            endDate=end_date,
            page=page,
            limit=limit,
            sortBy=sort_by,
            sortOrder=sort_order,
            reportType=report_type,
        )

    async def get_future_option_expirations(
        self,
        underlying: str,
        include_expired: str | None = 'false',
    ) -> dict[str, Any]:
        return await self.client.get_future_option_expirations(
            underlying=underlying,
            includeExpired=include_expired,
        )

    async def get_future_option_strikes(
        self,
        underlying: str,
        expiration_date: str,
        side: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_future_option_strikes(
            underlying=underlying,
            expirationDate=expiration_date,
            side=side,
        )

    async def get_future_option_chain(
        self,
        underlying: str,
        expiration_date: str,
        date: str | None = None,
        side: str | None = None,
        min_strike: float | None = None,
        max_strike: float | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_future_option_chain(
            underlying=underlying,
            expirationDate=expiration_date,
            date=date,
            side=side,
            minStrike=min_strike,
            maxStrike=max_strike,
        )

    async def get_future_option_historical(
        self,
        symbol: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_future_option_historical(
            symbol=symbol,
            startDate=start_date,
            endDate=end_date,
            sortOrder=sort_order,
        )

    async def get_future_option_analytics(
        self,
        underlying: str,
        expiration_date: str,
        date: str | None = None,
        side: str | None = None,
        min_strike: float | None = None,
        max_strike: float | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_future_option_analytics(
            underlying=underlying,
            expirationDate=expiration_date,
            date=date,
            side=side,
            minStrike=min_strike,
            maxStrike=max_strike,
            limit=limit,
        )

    async def get_future_option_analytics_history(
        self,
        symbol: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_future_option_analytics_history(
            symbol=symbol,
            startDate=start_date,
            endDate=end_date,
            sortOrder=sort_order,
        )

    async def list_futures(
        self,
        asset: str | None = None,
        segment: str | None = None,
        include_expired: str | None = 'false',
        page: int | None = 1,
        limit: int | None = 50,
        sort_by: str | None = 'expirationDate',
        sort_order: str | None = 'asc',
    ) -> dict[str, Any]:
        return await self.client.list_futures(
            asset=asset,
            segment=segment,
            includeExpired=include_expired,
            page=page,
            limit=limit,
            sortBy=sort_by,
            sortOrder=sort_order,
        )

    async def get_future_quotes(
        self,
        symbols: str,
    ) -> dict[str, Any]:
        return await self.client.get_future_quotes(
            symbols=symbols,
        )

    async def get_future_specs(
        self,
        symbols: str,
    ) -> dict[str, Any]:
        return await self.client.get_future_specs(
            symbols=symbols,
        )

    async def get_future_historical(
        self,
        symbol: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_future_historical(
            symbol=symbol,
            startDate=start_date,
            endDate=end_date,
            sortOrder=sort_order,
        )

    async def get_future_term_structure(
        self,
        asset: str,
        include_expired: str | None = 'false',
    ) -> dict[str, Any]:
        return await self.client.get_future_term_structure(
            asset=asset,
            includeExpired=include_expired,
        )

    async def get_inflation(
        self,
        historical: str | None = None,
        start: str | None = None,
        end: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_inflation(
            historical=historical,
            start=start,
            end=end,
            sortBy=sort_by,
            sortOrder=sort_order,
        )

    async def get_inflation_available(self) -> dict[str, Any]:
        return await self.client.get_inflation_available()

    async def get_macro_available(
        self,
        q: str | None = None,
        category: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_macro_available(
            q=q,
            category=category,
        )

    async def get_macro_series(
        self,
        symbols: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_order: str | None = 'desc',
        limit: int | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_macro_series(
            symbols=symbols,
            startDate=start_date,
            endDate=end_date,
            sortOrder=sort_order,
            limit=limit,
        )

    async def get_macro_latest(
        self,
        symbols: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_macro_latest(
            symbols=symbols,
        )

    async def get_prime_rate(
        self,
        historical: str | None = None,
        start: str | None = None,
        end: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_prime_rate(
            historical=historical,
            start=start,
            end=end,
            sortBy=sort_by,
            sortOrder=sort_order,
        )

    async def get_prime_rate_available(self) -> dict[str, Any]:
        return await self.client.get_prime_rate_available()

    async def get_option_expirations(
        self,
        underlying: str,
        include_expired: str | None = 'false',
    ) -> dict[str, Any]:
        return await self.client.get_option_expirations(
            underlying=underlying,
            includeExpired=include_expired,
        )

    async def get_option_strikes(
        self,
        underlying: str,
        expiration_date: str,
        side: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_option_strikes(
            underlying=underlying,
            expirationDate=expiration_date,
            side=side,
        )

    async def get_option_chain(
        self,
        underlying: str,
        expiration_date: str,
        date: str | None = None,
        side: str | None = None,
        min_strike: float | None = None,
        max_strike: float | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_option_chain(
            underlying=underlying,
            expirationDate=expiration_date,
            date=date,
            side=side,
            minStrike=min_strike,
            maxStrike=max_strike,
        )

    async def get_option_historical(
        self,
        symbol: str,
        expiration_date: str,
        strike: float | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_option_historical(
            symbol=symbol,
            expirationDate=expiration_date,
            strike=strike,
            startDate=start_date,
            endDate=end_date,
            sortOrder=sort_order,
        )

    async def get_option_analytics(
        self,
        underlying: str,
        expiration_date: str,
        date: str | None = None,
        side: str | None = None,
        min_strike: float | None = None,
        max_strike: float | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_option_analytics(
            underlying=underlying,
            expirationDate=expiration_date,
            date=date,
            side=side,
            minStrike=min_strike,
            maxStrike=max_strike,
            limit=limit,
        )

    async def get_option_analytics_history(
        self,
        symbol: str,
        expiration_date: str,
        strike: float | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_option_analytics_history(
            symbol=symbol,
            expirationDate=expiration_date,
            strike=strike,
            startDate=start_date,
            endDate=end_date,
            sortOrder=sort_order,
        )

    async def get_stock_quotes(
        self,
        symbols: str,
    ) -> dict[str, Any]:
        return await self.client.get_stock_quotes(
            symbols=symbols,
        )

    async def get_stock_historical(
        self,
        symbols: str,
        range: str | None = None,
        interval: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_stock_historical(
            symbols=symbols,
            range=range,
            interval=interval,
            startDate=start_date,
            endDate=end_date,
            sortOrder=sort_order,
        )

    async def get_stock_dividends(
        self,
        symbols: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_by: str | None = 'paymentDate',
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_stock_dividends(
            symbols=symbols,
            startDate=start_date,
            endDate=end_date,
            sortBy=sort_by,
            sortOrder=sort_order,
        )

    async def get_stock_profile(
        self,
        symbols: str,
    ) -> dict[str, Any]:
        return await self.client.get_stock_profile(
            symbols=symbols,
        )

    async def get_stock_statistics(
        self,
        symbols: str,
        period: str | None = 'annual',
        start_date: str | None = None,
        end_date: str | None = None,
        mode: str | None = 'current',
    ) -> dict[str, Any]:
        return await self.client.get_stock_statistics(
            symbols=symbols,
            period=period,
            startDate=start_date,
            endDate=end_date,
            mode=mode,
        )

    async def get_stock_financial_data(
        self,
        symbols: str,
        period: str | None = 'annual',
        start_date: str | None = None,
        end_date: str | None = None,
        mode: str | None = 'current',
    ) -> dict[str, Any]:
        return await self.client.get_stock_financial_data(
            symbols=symbols,
            period=period,
            startDate=start_date,
            endDate=end_date,
            mode=mode,
        )

    async def get_stock_balance_sheet(
        self,
        symbols: str,
        period: str | None = 'annual',
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_stock_balance_sheet(
            symbols=symbols,
            period=period,
            startDate=start_date,
            endDate=end_date,
        )

    async def get_stock_income_statement(
        self,
        symbols: str,
        period: str | None = 'annual',
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_stock_income_statement(
            symbols=symbols,
            period=period,
            startDate=start_date,
            endDate=end_date,
        )

    async def get_stock_cash_flow(
        self,
        symbols: str,
        period: str | None = 'annual',
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_stock_cash_flow(
            symbols=symbols,
            period=period,
            startDate=start_date,
            endDate=end_date,
        )

    async def get_stock_value_added(
        self,
        symbols: str,
        period: str | None = 'annual',
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_stock_value_added(
            symbols=symbols,
            period=period,
            startDate=start_date,
            endDate=end_date,
        )

    async def list_treasury(
        self,
        page: int | None = 1,
        limit: int | None = 20,
        search: str | None = None,
        indexer: str | None = None,
        coupon_type: str | None = None,
        sort_by: str | None = 'maturityDate',
        sort_order: str | None = 'asc',
    ) -> dict[str, Any]:
        return await self.client.list_treasury(
            page=page,
            limit=limit,
            search=search,
            indexer=indexer,
            couponType=coupon_type,
            sortBy=sort_by,
            sortOrder=sort_order,
        )

    async def get_treasury_indicators(
        self,
        symbols: str,
    ) -> dict[str, Any]:
        return await self.client.get_treasury_indicators(
            symbols=symbols,
        )

    async def get_treasury_indicators_history(
        self,
        symbols: str,
        start_date: str | None = None,
        end_date: str | None = None,
        sort_by: str | None = 'baseDate',
        sort_order: str | None = 'desc',
    ) -> dict[str, Any]:
        return await self.client.get_treasury_indicators_history(
            symbols=symbols,
            startDate=start_date,
            endDate=end_date,
            sortBy=sort_by,
            sortOrder=sort_order,
        )

    async def get_ticker_renames(
        self,
        symbols: str | None = None,
        search: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_ticker_renames(
            symbols=symbols,
            search=search,
            startDate=start_date,
            endDate=end_date,
        )

    async def resolve_tickers(
        self,
        symbols: str,
    ) -> dict[str, Any]:
        return await self.client.resolve_tickers(
            symbols=symbols,
        )

    async def get_ticker_coverage(
        self,
        symbols: str,
    ) -> dict[str, Any]:
        return await self.client.get_ticker_coverage(
            symbols=symbols,
        )

    async def get_tickers(
        self,
        search: str | None = None,
        sort_by: str | None = 'volume',
        sort_order: str | None = 'desc',
        page: int | None = 1,
        limit: int | None = 20,
        sector: str | None = None,
        subsector: str | None = None,
        type: str | None = None,
        sub_type: str | None = None,
    ) -> dict[str, Any]:
        return await self.client.get_tickers(
            search=search,
            sortBy=sort_by,
            sortOrder=sort_order,
            page=page,
            limit=limit,
            sector=sector,
            subsector=subsector,
            type=type,
            subType=sub_type,
        )

    async def get_user_usage(self) -> dict[str, Any]:
        return await self.client.get_user_usage()


async def get_brapi_service() -> AsyncIterator[BrapiService]:
    """Provide a request-scoped service and close its HTTP client afterwards."""
    service = BrapiService()
    try:
        yield service
    finally:
        await service.aclose()
