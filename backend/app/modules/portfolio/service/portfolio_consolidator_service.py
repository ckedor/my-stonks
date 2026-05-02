"""
Portfolio consolidator service - handles position consolidation and recalculation.

This service is intentionally session-scoped (one instance per session) and does
NOT orchestrate parallel work. Fan-out across assets and session lifecycle
belong to the call site (router/task), see
``app.modules.portfolio.tasks.consolidate_single_portfolio``.
"""

from datetime import datetime

import numpy as np
import pandas as pd
from app.config.logger import logger
from app.core.exceptions import NotFoundError
from app.infra.db.models.asset import Asset, Event
from app.infra.db.models.constants.asset_fixed_income_type import (
    ASSET_FIXED_INCOME_TYPE,
)
from app.infra.db.models.constants.asset_type import ASSET_TYPE
from app.infra.db.models.constants.currency import CURRENCY
from app.infra.db.models.constants.index import INDEX
from app.infra.db.models.constants.user_configuration import USER_CONFIGURATION
from app.infra.db.models.market_data import IndexHistory
from app.infra.db.models.portfolio import Dividend, PortfolioUserConfiguration, Position
from app.lib.utils.df import rows_to_df
from app.modules.market_data.service.market_data_service import MarketDataService
from app.modules.portfolio.domain.fixed_income import calculate_fixed_income_prices
from app.modules.portfolio.repositories import PortfolioRepository

from ..domain import portfolio_consolidation

# treasury_bond_type_id → INDEX id (None = prefixado, sem indexador)
TREASURY_INDEX_MAP = {
    1: INDEX.CDI,    # LFT  – Tesouro Selic
    2: None,         # LTN  – Tesouro Prefixado
    3: None,         # NTN-F – Tesouro Prefixado c/ Juros Semestrais
    4: INDEX.IPCA,   # NTN-B – Tesouro IPCA+ c/ Juros Semestrais
    5: INDEX.IPCA,   # NTN-B Principal – Tesouro IPCA+
}


class PortfolioConsolidatorService:
    
    def __init__(self, session):
        self.session = session
        self.repo = PortfolioRepository(session)
        self.market_data_service = MarketDataService(session)

    async def get_asset_ids_to_consolidate(self, portfolio_id: int) -> list[int]:
        """Retorna os asset_ids com posições recentes a consolidar.

        Janela definida em ``portfolio_consolidation.DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION``.
        Se não houver ativos recentes, retorna todos os ativos com transações
        no portfolio.
        """
        recent_ids = await self.repo.get_most_recent_asset_ids_from_position(
            portfolio_id=portfolio_id,
            delta_days=portfolio_consolidation.DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION,
        )
        if recent_ids:
            return recent_ids
        return await self.get_asset_ids_with_transactions(portfolio_id)

    async def get_asset_ids_with_transactions(
        self, portfolio_id: int
    ) -> list[int]:
        """Retorna todos os asset_ids com transações no portfolio."""
        asset_ids = await self.repo.get_asset_ids_with_transactions(portfolio_id)
        if not asset_ids:
            raise NotFoundError(
                f'Transactions not found for portfolio {portfolio_id}',
            )
        return asset_ids

    async def recalculate_position_asset(self, portfolio_id, asset_id):
        try:
            asset = await self.repo.get_asset_details(asset_id)
            if asset is None:
                raise NotFoundError(f'Asset {asset_id} not found')
            logger.info(f'Consolidando ativo: {asset.ticker}')

            transaction_rows = await self.repo.get_transactions(
                portfolio_id=portfolio_id, asset_id=asset_id
            )
            if not transaction_rows:
                await self.repo.delete(
                    Position,
                    by={'asset_id': asset_id, 'portfolio_id': portfolio_id},
                )
                return

            events = await self.repo.get(Event, order_by='date asc', by={'asset_id': asset.id})
            dividends_df = await self.repo.get(
                Dividend,
                by={'portfolio_id': portfolio_id, 'asset_id': asset_id},
                as_df=True,
            )
            init_date = pd.to_datetime(min(r['date'] for r in transaction_rows))
            usd_brl_df = await self.market_data_service.get_usd_brl_history(init_date)
            close_prices_df = await self._get_asset_prices(
                asset, transaction_rows, dividends_df, init_date
            )

            # --- Domain logic ---
            position_df = portfolio_consolidation.consolidate_positions(
                transaction_rows=transaction_rows,
                events=events,
                close_prices_df=close_prices_df,
                usd_brl_df=usd_brl_df,
                dividends_df=dividends_df,
            )

            # --- Persistence ---
            await self._persist_positions_db(position_df, init_date, asset, portfolio_id)
            logger.info(f'Sucesso ao consolidar ativo: {asset.ticker}')
        except Exception as e:
            ticker = asset.ticker if 'asset' in dir() and asset else f'id={asset_id}'
            logger.error(f'Falha ao calcular posições para {ticker}: {e}')

    async def _get_asset_prices(
        self, asset, transaction_rows, dividends_df, init_date
    ) -> pd.DataFrame:
        """Fetch native-currency close prices for ``asset``.

        Routes by asset type to the appropriate data source (fixed income,
        treasury, market data provider) and returns a DataFrame with columns
        ``date``, ``close``, ``currency`` (currency as ``CURRENCY`` id).
        """
        if portfolio_consolidation.is_fixed_income(asset):
            fixed_income = asset.fixed_income
            index_history_df = await self.repo.get(
                IndexHistory, by={'index_id': fixed_income.index.id}, as_df=True
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
            prices_df = await self._calculate_treasury_prices(
                asset, transactions_df, dividends_df
            )
            prices_df['currency'] = CURRENCY.BRL
            return prices_df

        return await self.market_data_service.get_asset_prices(asset, init_date)

    async def _persist_positions_db(
        self, position_df: pd.DataFrame, min_date: pd.Timestamp, asset: Asset, portfolio_id: int
    ):
        position_df['asset_id'] = asset.id
        position_df['portfolio_id'] = portfolio_id
        position_df = position_df[Position.COLUMNS]
        for col in ['quantity', 'portfolio_id', 'asset_id']:
            if col in position_df.columns:
                position_df.loc[:, col] = position_df[col].ffill()
        position_df = position_df[position_df['date'] >= min_date]
        
        values = position_df.to_dict(orient='records')

        max_date = position_df['date'].max()

        await self.repo.delete(
            Position,
            by={
                'portfolio_id': portfolio_id,
                'asset_id': asset.id,
                'date__gt': max_date,
            }
        )

        await self.repo.upsert_bulk(Position, values, unique_columns=['portfolio_id', 'asset_id', 'date'])
        await self.session.commit()

    async def _calculate_treasury_prices(self, asset, transactions_df, dividends_df):
        """Calcula preço do tesouro via índice + taxa, igual a renda fixa."""
        treasury = asset.treasury_bond
        fee = float(treasury.fee) if treasury.fee else 0.0
        index_id = TREASURY_INDEX_MAP.get(treasury.type_id)

        if index_id is not None:
            index_history_df = await self.repo.get(
                IndexHistory, by={'index_id': index_id}, as_df=True
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
        user_configuration = await self.repo.get(
            PortfolioUserConfiguration, 
            by={'portfolio_id': portfolio_id, 
                'configuration_name_id': USER_CONFIGURATION.FIIS_DIVIDENDS_INTEGRATION
                }, 
            first=True
        )
        if user_configuration.enabled is False:
            return
        
        logger.info(f'Consolidando dividendos de FIIs do portfolio {portfolio_id}')
        positions_df = rows_to_df(
            await self.repo.get_portfolio_position(
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
        
        merged_df = positions_df.merge(
            fii_dividends_df,
            on=['ticker', 'date'],
            how='left'
        )
        merged_df['value_per_share'] = merged_df['value_per_share'].fillna(0)
        if 'dividend' not in merged_df.columns:
            merged_df['dividend'] = 0
            
        original_dividends = merged_df['dividend'].copy()

        merged_df['dividend'] = np.where(
            merged_df['dividend'] == 0,
            round(merged_df['quantity'] * merged_df['value_per_share'], 2),
            merged_df['dividend']
        )

        new_dividends_df = merged_df[(original_dividends == 0) & (merged_df['dividend'] > 0)]
        
        if new_dividends_df.empty:
            logger.info(f'Nenhum novo dividendo de FIIs encontrado para o portfolio {portfolio_id}')
            return
        
        for _, row in new_dividends_df.iterrows():
            await self.repo.create(
                Dividend,
                {
                    'portfolio_id': portfolio_id,
                    'asset_id': row['asset_id'],
                    'date': row['date'],
                    'amount': row['dividend']
                }
            )
        await self.session.commit()
        logger.info(f"Dividendos de {row['ticker']} na data {row['date']} consolidados com sucesso")