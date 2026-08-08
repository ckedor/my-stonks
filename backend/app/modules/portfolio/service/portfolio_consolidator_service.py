"""
Portfolio consolidator service - handles position consolidation and recalculation.

This service does not orchestrate parallel work. Fan-out across assets belongs
to the call site (router/task), see
``app.modules.portfolio.tasks.consolidate_single_portfolio``.
"""

from datetime import datetime

import numpy as np
import pandas as pd
from app.config.logger import logger
from app.core.exceptions import NotFoundError
from app.modules.market_data.domain.assets import Asset, Event
from app.modules.market_data.domain.constants import (
    ASSET_FIXED_INCOME_TYPE,
    ASSET_TYPE,
    CURRENCY,
    INDEX,
)
from app.modules.portfolio.domain.constants import USER_CONFIGURATION
from app.modules.market_data.domain.market_data_series import MarketDataSeriesHistory
from app.modules.portfolio.domain.entities import Dividend, PortfolioUserConfiguration, Position
from app.infra.db.unit_of_work import UnitOfWork
from app.lib.utils.df import rows_to_df
from app.modules.market_data.service.market_data_service import MarketDataService
from app.modules.portfolio.domain.fixed_income import calculate_fixed_income_prices
from app.modules.portfolio.repositories import PortfolioRepository

from ..domain import portfolio_consolidation

# treasury_bond_type_id → INDEX id (None = prefixado, sem indexador)
TREASURY_INDEX_MAP = {
    1: INDEX.CDI,  # LFT  – Tesouro Selic
    2: None,  # LTN  – Tesouro Prefixado
    3: None,  # NTN-F – Tesouro Prefixado c/ Juros Semestrais
    4: INDEX.IPCA,  # NTN-B – Tesouro IPCA+ c/ Juros Semestrais
    5: INDEX.IPCA,  # NTN-B Principal – Tesouro IPCA+
}


class PortfolioConsolidatorService:
    def __init__(
        self,
        *,
        market_data_service: MarketDataService,
        uow: UnitOfWork | None = None,
        repository: PortfolioRepository | None = None,
    ):
        self.market_data_service = market_data_service
        self.uow = uow
        self.repository = repository

    def _read_repository(self) -> PortfolioRepository:
        if self.repository is None:
            raise RuntimeError('A repository is required for this read operation')
        return self.repository

    async def get_asset_ids_to_consolidate(self, portfolio_id: int) -> list[int]:
        """Retorna os asset_ids com posições recentes a consolidar.

        Janela definida em ``portfolio_consolidation.DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION``.
        Ativos vendidos e sem posição na janela não voltam ao fluxo incremental.
        """
        recent_ids = await self._read_repository().get_most_recent_asset_ids_from_position(
            portfolio_id=portfolio_id,
            delta_days=portfolio_consolidation.DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION,
        )
        return recent_ids

    async def get_asset_ids_with_transactions(self, portfolio_id: int) -> list[int]:
        """Retorna todos os asset_ids com transações no portfolio."""
        asset_ids = await self._read_repository().get_asset_ids_with_transactions(portfolio_id)
        if not asset_ids:
            raise NotFoundError(
                f'Transactions not found for portfolio {portfolio_id}',
            )
        return asset_ids

    async def recalculate_position_asset(self, portfolio_id, asset_id):
        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')
        try:
            async with self.uow as uow:
                repository = uow.portfolios
                market_data_repository = uow.market_data
                quote_repository = uow.quotes
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
                usd_brl_df = await self.market_data_service.get_usd_brl_history(
                    init_date,
                    repository=market_data_repository,
                )
                close_prices_df = await self._get_asset_prices(
                    asset,
                    transaction_rows,
                    dividends_df,
                    init_date,
                    repository=repository,
                    quote_repository=quote_repository,
                )
                position_df = portfolio_consolidation.consolidate_positions(
                    transaction_rows=transaction_rows,
                    events=events,
                    close_prices_df=close_prices_df,
                    usd_brl_df=usd_brl_df,
                    dividends_df=dividends_df,
                )
                await self._persist_positions_db(
                    position_df,
                    init_date,
                    asset,
                    portfolio_id,
                    repository=repository,
                )
                logger.info(f'Sucesso ao consolidar ativo: {asset.ticker}')
        except Exception as e:
            ticker = asset.ticker if 'asset' in dir() and asset else f'id={asset_id}'
            logger.error(f'Falha ao calcular posições para {ticker}: {e}')
            raise

    async def _get_asset_prices(  # noqa: PLR0913
        self,
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
        treasury, market data provider) and returns a DataFrame with columns
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

        return await self.market_data_service.get_asset_close_prices(
            asset_id=asset.id,
            ticker=asset.ticker,
            init_date=init_date,
            quote_repository=quote_repository,
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
        index_id = TREASURY_INDEX_MAP.get(treasury.type_id)

        if index_id is not None:
            index_history_df = await repository.get(
                MarketDataSeriesHistory, by={'series_id': index_id}, as_df=True
            )
            if index_history_df.empty:
                raise ValueError(
                    f'Não existe dados de histórico do índice {index_id} para {asset.ticker}'
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
        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')
        async with self.uow as uow:
            repository = uow.portfolios
            await self._consolidate_fii_dividends(
                portfolio_id,
                repository=repository,
            )

    async def _consolidate_fii_dividends(
        self,
        portfolio_id: int,
        *,
        repository: PortfolioRepository,
    ):
        user_configuration = await repository.get(
            PortfolioUserConfiguration,
            by={
                'portfolio_id': portfolio_id,
                'configuration_name_id': USER_CONFIGURATION.FIIS_DIVIDENDS_INTEGRATION,
            },
            first=True,
        )
        if user_configuration.enabled is False:
            return

        logger.info(f'Consolidando dividendos de FIIs do portfolio {portfolio_id}')
        positions_df = rows_to_df(
            await repository.get_portfolio_position(
                portfolio_id=portfolio_id,
                asset_type_id=ASSET_TYPE.FII,
                start_date=pd.Timestamp.now() - pd.DateOffset(days=30),
            ),
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend', 'dividend_usd'],
        )
        if positions_df.empty:
            return

        fii_dividends_df = await self.market_data_service.get_fii_dividends_df(
            positions_df['ticker'].unique().tolist()
        )

        merged_df = positions_df.merge(fii_dividends_df, on=['ticker', 'date'], how='left')
        merged_df['value_per_share'] = merged_df['value_per_share'].fillna(0)
        if 'dividend' not in merged_df.columns:
            merged_df['dividend'] = 0

        original_dividends = merged_df['dividend'].copy()

        merged_df['dividend'] = np.where(
            merged_df['dividend'] == 0,
            round(merged_df['quantity'] * merged_df['value_per_share'], 2),
            merged_df['dividend'],
        )

        new_dividends_df = merged_df[(original_dividends == 0) & (merged_df['dividend'] > 0)]

        if new_dividends_df.empty:
            logger.info(f'Nenhum novo dividendo de FIIs encontrado para o portfolio {portfolio_id}')
            return

        for _, row in new_dividends_df.iterrows():
            await repository.create(
                Dividend,
                {
                    'portfolio_id': portfolio_id,
                    'asset_id': row['asset_id'],
                    'date': row['date'],
                    'amount': row['dividend'],
                },
            )
        logger.info(f'Dividendos de {row["ticker"]} na data {row["date"]} consolidados com sucesso')

    async def aclose(self) -> None:
        await self.market_data_service.aclose()
