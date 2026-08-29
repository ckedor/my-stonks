"""
Portfolio consolidator service - handles position consolidation and recalculation.

This service does not orchestrate parallel work. Fan-out across assets belongs
to the call site (router/task), see
``app.modules.portfolio.tasks.consolidate_portfolio``.
"""

from datetime import datetime

import pandas as pd

from app.config.logger import logger
from app.core.exceptions import NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.lib.utils.df import rows_to_df
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.assets import Asset, Event
from app.modules.market_data.domain.constants import (
    ASSET_FIXED_INCOME_TYPE,
    ASSET_TYPE,
    CURRENCY,
    SERIES,
)
from app.modules.market_data.domain.market_data_series import MarketDataSeriesHistory
from app.modules.market_data.domain.quote import persisted_close_prices_df
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService
from app.modules.portfolio.domain.constants import USER_CONFIGURATION
from app.modules.portfolio.domain.entities import Dividend, PortfolioUserConfiguration, Position
from app.modules.portfolio.domain.fixed_income import calculate_fixed_income_prices
from app.modules.portfolio.repositories import PortfolioRepository

from ..domain import portfolio_consolidation

# treasury_bond_type_id → SERIES id (None = prefixado, sem indexador)
#: Quanto para trás o job olha a cada corrida. Ele roda todo dia, e um
#: fundo paga uma vez por mês: trinta dias cobre um provento anunciado
#: com atraso sem reler a história inteira toda madrugada.
FII_DIVIDEND_WINDOW_DAYS = 30

#: Quanto antes da janela as posições são lidas, para que a data-com de um
#: pagamento na borda ainda esteja no quadro. Um FII costuma pagar duas
#: semanas depois da data-com; trinta dias cobre com folga.
FII_EX_DATE_MARGIN_DAYS = 30

TREASURY_INDEX_MAP = {
    1: SERIES.CDI,  # LFT  – Tesouro Selic
    2: None,  # LTN  – Tesouro Prefixado
    3: None,  # NTN-F – Tesouro Prefixado c/ Juros Semestrais
    4: SERIES.IPCA,  # NTN-B – Tesouro IPCA+ c/ Juros Semestrais
    5: SERIES.IPCA,  # NTN-B Principal – Tesouro IPCA+
}


class PortfolioConsolidatorService:
    def __init__(
        self,
        *,
        provider: MarketDataProvider,
        uow: UnitOfWork,
        usd_brl_service: UsdBrlReadService,
    ):
        self.provider = provider
        self.uow = uow
        self.usd_brl_service = usd_brl_service

    async def get_asset_ids_to_consolidate(self, portfolio_id: int) -> list[int]:
        """Retorna os asset_ids com posições recentes a consolidar.

        Janela definida em ``portfolio_consolidation.DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION``.
        Ativos vendidos e sem posição na janela não voltam ao fluxo incremental.
        """
        async with self.uow as uow:
            return await uow.portfolios.get_most_recent_asset_ids_from_position(
                portfolio_id=portfolio_id,
                delta_days=portfolio_consolidation.DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION,
            )

    async def get_asset_ids_with_transactions(self, portfolio_id: int) -> list[int]:
        """Retorna todos os asset_ids com transações no portfolio."""
        async with self.uow as uow:
            asset_ids = await uow.portfolios.get_asset_ids_with_transactions(portfolio_id)
        if not asset_ids:
            raise NotFoundError(
                f'Transactions not found for portfolio {portfolio_id}',
            )
        return asset_ids

    async def recalculate_position_asset(self, portfolio_id, asset_id):
        async with self.uow as uow:
            repository = uow.portfolios
            asset = await repository.get_asset_details(asset_id)
            if asset is None:
                raise NotFoundError(f'Asset {asset_id} not found')
            logger.info(f'Consolidando ativo: {asset.ticker}')

            transaction_rows = await repository.get_transactions(
                portfolio_id=portfolio_id, asset_id=asset_id
            )
            if not transaction_rows:
                await repository.delete(
                    Position,
                    by={'asset_id': asset_id, 'portfolio_id': portfolio_id},
                )
                await uow.commit()
                return

            events = await repository.get(
                Event,
                order_by='date asc',
                by={'asset_id': asset.id},
            )
            dividends_df = await repository.get(
                Dividend,
                by={'portfolio_id': portfolio_id, 'asset_id': asset_id},
                as_df=True,
            )
            init_date = pd.to_datetime(min(r['date'] for r in transaction_rows))
            usd_brl_df = await self.usd_brl_service.get_history_df(
                start_date=pd.Timestamp(init_date).date()
            )
            close_prices_df = await self._get_asset_prices(
                asset,
                transaction_rows,
                dividends_df,
                init_date,
                repository=repository,
                quote_repository=uow.quotes,
            )
            position_df = portfolio_consolidation.consolidate_positions(
                transaction_rows=transaction_rows,
                events=events,
                close_prices_df=close_prices_df,
                usd_brl_df=usd_brl_df,
                dividends_df=dividends_df,
            )
            self._reject_unpriced_positions(position_df, asset)
            await self._persist_positions_db(
                position_df,
                init_date,
                asset,
                portfolio_id,
                repository=repository,
            )
            await uow.commit()
            logger.info(f'Sucesso ao consolidar ativo: {asset.ticker}')

    @staticmethod
    async def _get_asset_prices(  # noqa: PLR0913
        asset,
        transaction_rows,
        dividends_df,
        init_date,
        *,
        repository: PortfolioRepository,
        quote_repository,
    ) -> pd.DataFrame:
        """Fetch native-currency close prices for ``asset``.

        Routes by asset type to the appropriate data source (fixed income,
        treasury, persisted quotes) and returns a DataFrame with columns
        ``date``, ``close``, ``currency`` (currency as ``CURRENCY`` id).
        """
        if portfolio_consolidation.is_fixed_income(asset):
            fixed_income = asset.fixed_income
            index_history_df = await repository.get(
                MarketDataSeriesHistory,
                by={'series_id': fixed_income.index.id},
                as_df=True,
            )
            if index_history_df.empty:
                raise ValueError(
                    f'Não existe dados de histórico do índice {fixed_income.index.short_name}'
                )
            transactions_df = portfolio_consolidation.build_transactions_df(transaction_rows)
            prices_df = calculate_fixed_income_prices(
                fixed_income_type_id=fixed_income.fixed_income_type_id,
                fee=fixed_income.fee,
                transactions_df=transactions_df,
                index_history_df=index_history_df,
                dividends_df=dividends_df if not dividends_df.empty else None,
            )
            prices_df['currency'] = CURRENCY.BRL
            return prices_df

        if portfolio_consolidation.is_treasury(asset):
            transactions_df = portfolio_consolidation.build_transactions_df(transaction_rows)
            prices_df = await PortfolioConsolidatorService._calculate_treasury_prices(
                asset,
                transactions_df,
                dividends_df,
                repository=repository,
            )
            prices_df['currency'] = CURRENCY.BRL
            return prices_df

        # Persisted quotes only: this read never falls back to a provider, so
        # missing history is explicit and quote ingestion can run before
        # consolidation.
        quotes = await quote_repository.get_quotes(
            [asset.id],
            start_date=pd.Timestamp(init_date).date(),
        )
        if not quotes:
            raise NotFoundError(
                f'No persisted quotes found for asset {asset.ticker}',
                context={'asset_id': asset.id, 'ticker': asset.ticker},
            )
        close_prices_df = persisted_close_prices_df(quotes)
        if close_prices_df.empty:
            raise NotFoundError(
                f'No persisted close prices found for asset {asset.ticker}',
                context={'asset_id': asset.id, 'ticker': asset.ticker},
            )
        return close_prices_df

    @staticmethod
    def _reject_unpriced_positions(position_df: pd.DataFrame, asset: Asset) -> None:
        """Refuse to store a position that has no price.

        It means the asset holds a position on a date its quote history does not
        reach. ``position.price`` is NOT NULL, so without this the whole
        portfolio consolidation dies on an opaque integrity error that names
        neither the asset nor the gap.
        """
        if position_df.empty or 'price' not in position_df:
            return
        unpriced = position_df[position_df['price'].isna()]
        if unpriced.empty:
            return
        first, last = unpriced['date'].min(), unpriced['date'].max()
        raise NotFoundError(
            f'No quotes for {asset.ticker} covering positions held between '
            f'{first:%Y-%m-%d} and {last:%Y-%m-%d}. Ingest its quote history '
            f'from {first:%Y-%m-%d} before consolidating.',
            context={
                'asset_id': asset.id,
                'ticker': asset.ticker,
                'missing_from': f'{first:%Y-%m-%d}',
                'missing_to': f'{last:%Y-%m-%d}',
                'unpriced_days': len(unpriced),
            },
        )

    @staticmethod
    async def _persist_positions_db(
        position_df: pd.DataFrame,
        min_date: pd.Timestamp,
        asset: Asset,
        portfolio_id: int,
        *,
        repository: PortfolioRepository,
    ):
        if position_df.empty:
            await repository.delete(
                Position,
                by={'portfolio_id': portfolio_id, 'asset_id': asset.id},
            )
            return

        position_df['asset_id'] = asset.id
        position_df['portfolio_id'] = portfolio_id
        position_df = position_df[Position.COLUMNS]
        for col in ['quantity', 'portfolio_id', 'asset_id']:
            if col in position_df.columns:
                position_df.loc[:, col] = position_df[col].ffill()
        position_df = position_df[position_df['date'] >= min_date]

        values = position_df.to_dict(orient='records')

        max_date = position_df['date'].max()

        await repository.delete(
            Position,
            by={
                'portfolio_id': portfolio_id,
                'asset_id': asset.id,
                'date__gt': max_date,
            },
        )

        await repository.upsert_bulk(
            Position, values, unique_columns=['portfolio_id', 'asset_id', 'date']
        )

    @staticmethod
    async def _calculate_treasury_prices(
        asset,
        transactions_df,
        dividends_df,
        *,
        repository: PortfolioRepository,
    ):
        """Calcula preço do tesouro via índice + taxa, igual a renda fixa."""
        treasury = asset.treasury_bond
        fee = float(treasury.fee) if treasury.fee else 0.0
        series_id = TREASURY_INDEX_MAP.get(treasury.type_id)

        if series_id is not None:
            index_history_df = await repository.get(
                MarketDataSeriesHistory, by={'series_id': series_id}, as_df=True
            )
            if index_history_df.empty:
                raise ValueError(
                    f'Não existe dados de histórico do índice {series_id} para {asset.ticker}'
                )
        else:
            # Prefixado: sem indexador, só taxa fixa
            dates = pd.date_range(start=transactions_df['date'].min(), end=datetime.today())
            index_history_df = pd.DataFrame({'date': dates, 'close': 0.0})

        return calculate_fixed_income_prices(
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.INDEX_PLUS,
            fee=fee,
            transactions_df=transactions_df,
            index_history_df=index_history_df,
            dividends_df=dividends_df if not dividends_df.empty else None,
        )

    async def consolidate_fii_dividends(self, portfolio_id: int):
        async with self.uow as uow:
            repository = uow.portfolios
            await self._consolidate_fii_dividends(
                portfolio_id,
                repository=repository,
            )
            await uow.commit()

    async def _consolidate_fii_dividends(
        self,
        portfolio_id: int,
        *,
        repository: PortfolioRepository,
    ):
        """Record the payments a portfolio's real-estate funds made.

        Only what the fund paid as income: an amortization returns principal
        and is not a dividend, and the provider's own label is the only thing
        that separates the two. The previous source published no label at all,
        so every amortization landed in the portfolio as income.

        How many shares a payment is worth is settled on its **ex date**, not
        on the day the cash arrives -- that is what the date is for. Selling
        between the two does not forfeit the payment, and the position series
        stops at a full exit, so reading the quantity on the payment date paid
        that holder nothing at all.
        """
        user_configuration = await repository.get(
            PortfolioUserConfiguration,
            by={
                'portfolio_id': portfolio_id,
                'configuration_name_id': USER_CONFIGURATION.FIIS_DIVIDENDS_INTEGRATION,
            },
            first=True,
        )
        # Sem configuração é integração desligada. Ler `.enabled` de None
        # levantava AttributeError e derrubava o loop das carteiras seguintes.
        if user_configuration is None or user_configuration.enabled is False:
            return

        logger.info(f'Consolidando dividendos de FIIs do portfolio {portfolio_id}')
        window_start = pd.Timestamp.now().normalize() - pd.DateOffset(days=FII_DIVIDEND_WINDOW_DAYS)
        positions_df = rows_to_df(
            await repository.get_portfolio_position(
                portfolio_id=portfolio_id,
                asset_type_id=ASSET_TYPE.FII,
                # Mais para trás do que a janela dos pagamentos: a data-com
                # antecede o pagamento, e é ela que precisa estar no quadro.
                start_date=window_start - pd.DateOffset(days=FII_EX_DATE_MARGIN_DAYS),
            ),
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend', 'dividend_usd'],
        )
        if positions_df.empty:
            return

        dividends_by_ticker = await self.provider.fetch_fii_dividends(
            positions_df['ticker'].unique().tolist()
        )
        payments_df = self._income_payments_df(dividends_by_ticker)
        payments_df = payments_df[payments_df['date'] >= window_start]
        if payments_df.empty:
            logger.info(f'Nenhum provento de FII reportado para o portfolio {portfolio_id}')
            return

        new_dividends_df = self._payments_owed(payments_df, positions_df)
        if new_dividends_df.empty:
            logger.info(f'Nenhum novo dividendo de FIIs encontrado para o portfolio {portfolio_id}')
            return

        # Um provento já lançado -- à mão ou por uma corrida anterior -- não é
        # relançado. Vem da tabela, e não da linha de posição do dia do
        # pagamento, que pode não existir para quem vendeu depois da data-com.
        recorded = await repository.get(
            Dividend,
            by={'portfolio_id': portfolio_id, 'date__gte': window_start.date()},
        )
        already_recorded = {(item.asset_id, pd.Timestamp(item.date)) for item in recorded}

        for _, row in new_dividends_df.iterrows():
            if (row['asset_id'], row['date']) in already_recorded:
                continue
            await repository.create(
                Dividend,
                {
                    'portfolio_id': portfolio_id,
                    'asset_id': row['asset_id'],
                    'date': row['date'],
                    'amount': row['amount'],
                },
            )
            logger.info('Provento de %s em %s consolidado', row['ticker'], row['date'].date())

    @staticmethod
    def _payments_owed(payments_df: pd.DataFrame, positions_df: pd.DataFrame) -> pd.DataFrame:
        """What each payment is worth, given what was held when it was settled.

        The join is on the ex date, so a position sold before the payment
        landed still earns it. Payments that share a payment date are summed
        after being valued, each by the quantity held on its own ex date: the
        portfolio receives one amount that day, from possibly two events.
        """
        held = positions_df[['ticker', 'date', 'asset_id', 'quantity']].rename(
            columns={'date': 'ex_date'}
        )
        owed = payments_df.merge(held, on=['ticker', 'ex_date'], how='inner')
        if owed.empty:
            return owed.assign(amount=pd.Series(dtype=float))

        owed['amount'] = (owed['quantity'] * owed['value_per_share']).round(2)
        owed = owed.groupby(['ticker', 'asset_id', 'date'], as_index=False)['amount'].sum()
        return owed[owed['amount'] > 0]

    @staticmethod
    def _income_payments_df(dividends_by_ticker: dict[str, list]) -> pd.DataFrame:
        """The income payments, as a frame keyed the way positions are.

        Amortizations are dropped here rather than downstream: past this point
        a payment is just an amount, and nothing would tell them apart again.
        A fund that publishes no ex date falls back to the payment date, which
        is the only day it gives us to settle the holding on.
        """
        rows = [
            {
                'ticker': ticker,
                'date': pd.Timestamp(dividend.payment_date),
                'ex_date': pd.Timestamp(dividend.ex_date or dividend.payment_date),
                'value_per_share': dividend.value_per_share,
            }
            for ticker, dividends in dividends_by_ticker.items()
            for dividend in dividends
            if dividend.is_income
        ]
        if not rows:
            return pd.DataFrame(columns=['ticker', 'date', 'ex_date', 'value_per_share'])
        return pd.DataFrame(rows)

    async def aclose(self) -> None:
        await self.provider.close()
