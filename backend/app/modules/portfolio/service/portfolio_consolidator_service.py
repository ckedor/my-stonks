# app/modules/portfolio/service/portfolio_consolidator_service.py
"""
Portfolio consolidator service - handles position consolidation and recalculation.
"""

import asyncio
from datetime import datetime

import numpy as np
import pandas as pd
from app.config.logger import logger
from app.core.exceptions import NotFoundError
from app.infra.db.models.asset import Asset, Event
from app.infra.db.models.asset_fixed_income import FixedIncome
from app.infra.db.models.constants.asset_fixed_income_type import (
    ASSET_FIXED_INCOME_TYPE,
)
from app.infra.db.models.constants.asset_type import ASSET_TYPE
from app.infra.db.models.constants.currency import CURRENCY, CURRENCY_MAP
from app.infra.db.models.constants.index import INDEX
from app.infra.db.models.constants.user_configuration import USER_CONFIGURATION
from app.infra.db.models.market_data import IndexHistory
from app.infra.db.models.portfolio import (
    Dividend,
    PortfolioUserConfiguration,
    Position,
    Transaction,
)
from app.infra.db.session import AsyncSessionLocal
from app.lib.finance.trade import average_price
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.service.market_data_service import MarketDataService
from app.modules.portfolio.domain.fixed_income import calculate_fixed_income_prices
from app.modules.portfolio.repositories import PortfolioRepository

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

    async def consolidate_position_portfolio(self, portfolio_id):
        logger.info(f'Consolidando posições do portfolio {portfolio_id}')
        
        positions_df = await self.repo.get(
            Position,
            by={
                'portfolio_id': portfolio_id,
            },
            order_by='date desc',
            as_df=True,
        )
        if positions_df.empty:
            await self.recalculate_all_positions_portfolio(portfolio_id)
            return

        recent_date = positions_df['date'].max() - pd.DateOffset(days=10)
        asset_ids = positions_df[positions_df['date'] >= recent_date]['asset_id'].unique().tolist()
        
        # Executa em paralelo com sessões independentes
        tasks = [
            self._recalculate_position_asset_with_session(portfolio_id, asset_id)
            for asset_id in asset_ids
        ]
        await asyncio.gather(*tasks)

    async def _recalculate_position_asset_with_session(self, portfolio_id: int, asset_id: int):
        """Recalcula posição de um ativo criando sua própria sessão de banco."""
        async with AsyncSessionLocal() as session:
            try:
                service = PortfolioConsolidatorService(session)
                await service.recalculate_position_asset(portfolio_id, asset_id)
            except Exception as e:
                logger.error(f'Falha ao recalcular ativo {asset_id} do portfolio {portfolio_id}: {e}')

    async def recalculate_position_asset(self, portfolio_id, asset_id):
        try:
            asset = await self.repo.get(Asset, asset_id, first=True, relations=["treasury_bond", "fixed_income"]) #TODO: eu preciso fazer o select in load do trasury_bond. Mas aqui não faz mt sentido. Repensar.
            logger.info(f'Consolidando ativo: {asset.ticker}')
            transactions_df = await self._get_transactions(portfolio_id, asset_id)
            
            if transactions_df.empty:
                await self.repo.delete(
                    Position,
                    by={'asset_id': asset_id, 'portfolio_id': portfolio_id},
                )
                return
            events = await self.repo.get(Event, order_by='date asc', by={'asset_id': asset.id})
            if len(events) > 0:
                for event in events:
                    mask = transactions_df['date'] < pd.to_datetime(event.date)
                    transactions_df.loc[mask, 'quantity'] *= event.factor

            prices_df = await self._get_prices(transactions_df, asset, portfolio_id)
            
            start_date = transactions_df['date'].min()
            end_date = prices_df['date'].max()
            full_dates = pd.DataFrame({'date': pd.date_range(start=start_date, end=end_date)})
            position_df = full_dates.merge(prices_df, on='date', how='left')
            position_df = position_df.merge(transactions_df, on='date', how='left')
            
            for col in ['price', 'price_usd', 'average_price', 'average_price_usd']:
                if col in position_df.columns:
                    position_df[col] = position_df[col].ffill()

            # Compute cumulative total invested (BRL and USD) before cumsum on quantity
            # At this point, quantity is NaN on non-trade days and the per-day delta on trade days
            raw_qty = position_df['quantity'].fillna(0)
            position_df['total_invested'] = (
                raw_qty * position_df['transaction_price_brl'].fillna(0)
            ).cumsum()
            position_df['total_invested_usd'] = (
                raw_qty * position_df['transaction_price_usd'].fillna(0)
            ).cumsum()

            position_df['quantity'] = raw_qty.cumsum().round(6)
            
            # Se a quantidade final é 0, o ativo foi vendido por completo.
            # Trunca as posições até a última data com quantidade > 0.
            if position_df['quantity'].iloc[-1] == 0:
                last_nonzero = position_df[position_df['quantity'] > 0]
                if last_nonzero.empty:
                    await self.repo.delete(
                        Position,
                        by={'asset_id': asset_id, 'portfolio_id': portfolio_id},
                    )
                    return
                position_df = position_df.loc[:last_nonzero.index[-1]].copy()

            # Merge dividends so returns include dividend yield
            dividends_df = await self.repo.get(
                Dividend,
                by={'portfolio_id': portfolio_id, 'asset_id': asset_id},
                as_df=True,
            )
            if not dividends_df.empty:
                dividends_df['date'] = pd.to_datetime(dividends_df['date'])
                div_agg = (
                    dividends_df.groupby('date')
                    .agg(dividend=('amount', 'sum'), dividend_usd=('amount_usd', 'sum'))
                    .reset_index()
                )
                position_df = position_df.merge(div_agg, on='date', how='left')
            if 'dividend' not in position_df.columns:
                position_df['dividend'] = 0.0
            if 'dividend_usd' not in position_df.columns:
                position_df['dividend_usd'] = 0.0
            position_df['dividend'] = position_df['dividend'].fillna(0.0)
            position_df['dividend_usd'] = position_df['dividend_usd'].fillna(0.0)

            self._calculate_returns(position_df)
            
            await self._persist_positions_db(position_df, transactions_df['date'].min(), asset, portfolio_id)
            logger.info(f'Sucesso ao consolidar ativo: {asset.ticker}')
        except Exception as e:
            ticker = asset.ticker if 'asset' in dir() and asset else f'id={asset_id}'
            logger.error(f'Falha ao calcular posições para {ticker}: {e}')

    async def _get_transactions(self, portfolio_id, asset_id):
        trans_df = await self.repo.get_transactions_df(
            portfolio_id=portfolio_id,
            asset_id=asset_id
        )

        if trans_df.empty:
            return trans_df

        trans_df['date'] = pd.to_datetime(trans_df['date'])
        trans_df = trans_df.sort_values(by='date')

        trans_df = (
            trans_df.groupby('date', as_index=False)
            .apply(
                lambda g: pd.Series({
                    'quantity': g['quantity'].sum(),
                    'price': (g['price'] * g['quantity']).sum() / g['quantity'].sum(),
                    'currency_id': g['currency_id'].iloc[0],
                })
            )
            .reset_index(drop=True)
        )
        
        usd_brl_df = await self.market_data_service.get_usd_brl_history(trans_df['date'].min())

        trans_df = trans_df.merge(usd_brl_df[['date', 'usdbrl']], on='date', how='left')
        trans_df['transaction_price_brl'] = trans_df.apply(
            lambda row: row['price'] if row['currency_id'] == 1 else row['price'] * row['usdbrl'],
            axis=1
        )
        trans_df['transaction_price_usd'] = trans_df.apply(
            lambda row: row['price'] if row['currency_id'] == 2 else row['price'] / row['usdbrl'],
            axis=1
        )
        
        trans_df['average_price'] = average_price(trans_df, price_col='transaction_price_brl')
        trans_df['average_price_usd'] = average_price(trans_df, price_col='transaction_price_usd')
        trans_df = trans_df[['date', 'quantity', 'transaction_price_brl', 'transaction_price_usd', 'average_price', 'average_price_usd']]
        return trans_df

    async def _get_prices(self, asset_transactions_df, asset, portfolio_id):
        init_date = asset_transactions_df['date'].min()
        market_data_provider = MarketDataProvider()
        if self._is_fixed_income(asset):
            fixed_income = await self.repo.get(
                FixedIncome, by={'asset_id': asset.id}, first=True
            )
            index_history_df = await self.repo.get(
                IndexHistory, by={'index_id': fixed_income.index.id}, as_df=True
            )
            if index_history_df.empty:
                raise ValueError(
                    f'Não existe dados de histórico do índice {fixed_income.index.short_name}'
                )
            dividends_df = await self.repo.get(
                Dividend,
                by={'portfolio_id': portfolio_id, 'asset_id': asset.id},
                as_df=True,
            )
            prices_df = calculate_fixed_income_prices(
                fixed_income_type_id=fixed_income.fixed_income_type_id,
                fee=fixed_income.fee,
                transactions_df=asset_transactions_df,
                index_history_df=index_history_df,
                dividends_df=dividends_df if not dividends_df.empty else None,
            )
            prices_df['currency'] = CURRENCY.BRL
        elif self._is_treasury(asset):
            prices_df = await self._calculate_treasury_prices(
                asset, asset_transactions_df, portfolio_id
            )
            prices_df['currency'] = CURRENCY.BRL
        else:
            prices_df = await market_data_provider.get_asset_prices(asset, init_date)
            prices_df = self._extend_value_to_today(prices_df, 'close')
            prices_df = prices_df[['date', 'close', 'currency']]
            prices_df['currency'] = prices_df['currency'].map(CURRENCY_MAP)
            prices_df['currency'] = prices_df['currency'].ffill()

        usd_brl_df = await self.market_data_service.get_usd_brl_history(asset_transactions_df['date'].min())
        prices_df = prices_df.merge(usd_brl_df[['date', 'usdbrl']], on='date', how='left')
        
        prices_df['price'] = prices_df.apply(
            lambda row: row['close'] if row['currency'] == CURRENCY.BRL else row['close'] * row['usdbrl'],
            axis=1
        )
        prices_df['price_usd'] = prices_df.apply(
            lambda row: row['close'] if row['currency'] == CURRENCY.USD else row['close'] / row['usdbrl'],
            axis=1
        )
        prices_df = prices_df[['date', 'price', 'price_usd']]
        prices_df = prices_df[prices_df['date'] >= init_date]
        
        return prices_df

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

    async def recalculate_all_positions_portfolio(self, portfolio_id):
        transactions_df = await self.repo.get(
            Transaction, by={'portfolio_id': portfolio_id}, as_df=True
        )

        if transactions_df.empty:
            raise NotFoundError(
                f'Transactions not found for portfolio {portfolio_id}',
            )

        asset_ids = transactions_df['asset_id'].unique().tolist()
        
        # Executa em paralelo com sessões independentes
        tasks = [
            self._recalculate_position_asset_with_session(portfolio_id, asset_id)
            for asset_id in asset_ids
        ]
        await asyncio.gather(*tasks)

    @staticmethod
    def _is_fixed_income(asset):
        return asset.asset_type.id in {
            ASSET_TYPE.CRI,
            ASSET_TYPE.CRA,
            ASSET_TYPE.DEB,
            ASSET_TYPE.CDB,
            ASSET_TYPE.LCA,
        }

    @staticmethod
    def _is_treasury(asset):
        return asset.asset_type.id == ASSET_TYPE.TREASURY

    async def _calculate_treasury_prices(self, asset, transactions_df, portfolio_id):
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

        dividends_df = await self.repo.get(
            Dividend,
            by={'portfolio_id': portfolio_id, 'asset_id': asset.id},
            as_df=True,
        )

        return calculate_fixed_income_prices(
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.INDEX_PLUS,
            fee=fee,
            transactions_df=transactions_df,
            index_history_df=index_history_df,
            dividends_df=dividends_df if not dividends_df.empty else None,
        )

    @staticmethod
    def _calculate_returns(position_df):
        # Zero out returns when investor had no exposure:
        # - days where quantity is 0
        # - day of rebuy (prev day qty was 0, price change doesn't represent earned return)
        prev_qty = position_df['quantity'].shift(1).fillna(0)
        no_exposure = (position_df['quantity'] == 0) | (prev_qty == 0)

        # BRL
        position_df['daily_return'] = position_df['price'].pct_change(fill_method=None).infer_objects(copy=False).fillna(0)
        # Add dividend yield: dividend / (quantity * previous price)
        if 'dividend' in position_df.columns:
            base_value = position_df['quantity'] * position_df['price'].shift(1)
            position_df['daily_return'] += (
                position_df['dividend'] / base_value.replace(0, pd.NA)
            ).infer_objects(copy=False).fillna(0)
        position_df.loc[no_exposure, 'daily_return'] = 0
        position_df['acc_return'] = (1 + position_df['daily_return']).cumprod() - 1

        position_df['twelve_months_return'] = None
        position_df['date_12m_ago'] = position_df['date'] - pd.DateOffset(years=1)
        acc_map_brl = position_df.drop_duplicates(subset='date', keep='last').set_index('date')['acc_return']
        position_df['acc_return_12m_ago'] = position_df['date_12m_ago'].map(acc_map_brl)
        position_df['twelve_months_return'] = (
            (1 + position_df['acc_return']) / (1 + position_df['acc_return_12m_ago']) - 1
        )

        # CAGR BRL
        start_date = position_df['date'].iloc[0]
        position_df['days_since_start'] = (position_df['date'] - start_date).dt.days
        position_df['cagr'] = None
        mask = position_df['days_since_start'] > 0
        years = position_df.loc[mask, 'days_since_start'] / 365.25
        position_df.loc[mask, 'cagr'] = (1 + position_df.loc[mask, 'acc_return']) ** (1 / years) - 1

        # USD
        position_df['daily_return_usd'] = (
            position_df['price_usd'].pct_change(fill_method=None).infer_objects(copy=False).fillna(0)
        )
        if 'dividend_usd' in position_df.columns:
            base_value_usd = position_df['quantity'] * position_df['price_usd'].shift(1)
            position_df['daily_return_usd'] += (
                position_df['dividend_usd'] / base_value_usd.replace(0, pd.NA)
            ).infer_objects(copy=False).fillna(0)
        position_df.loc[no_exposure, 'daily_return_usd'] = 0
        position_df['acc_return_usd'] = (1 + position_df['daily_return_usd']).cumprod() - 1

        acc_map_usd = position_df.drop_duplicates(subset='date', keep='last').set_index('date')['acc_return_usd']
        position_df['acc_return_usd_12m_ago'] = position_df['date_12m_ago'].map(acc_map_usd)
        position_df['twelve_months_return_usd'] = (
            (1 + position_df['acc_return_usd']) / (1 + position_df['acc_return_usd_12m_ago']) - 1
        )

        # CAGR USD
        position_df['cagr_usd'] = None
        years_usd = position_df.loc[mask, 'days_since_start'] / 365.25
        position_df.loc[mask, 'cagr_usd'] = (1 + position_df.loc[mask, 'acc_return_usd']) ** (1 / years_usd) - 1

        return position_df

    @staticmethod
    def _extend_value_to_today(
        prices_df: pd.DataFrame, value_field: str, date_field: str = 'date'
    ) -> pd.DataFrame:
        df = prices_df.copy()
        df[date_field] = pd.to_datetime(df[date_field])
        full_range = pd.DataFrame({
            date_field: pd.date_range(start=df[date_field].min(), end=datetime.today(), freq='D')
        })
        df = pd.merge(full_range, df, on=date_field, how='left')
        df[value_field] = df[value_field].ffill()

        return df

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
        positions_df = await self.repo.get_portfolio_position_df(
            portfolio_id=portfolio_id,
            asset_type_id=ASSET_TYPE.FII,
            start_date=pd.Timestamp.now() - pd.DateOffset(days=30),
        )
        if positions_df.empty:
            return
        
        market_data_provider = MarketDataProvider()
        fii_dividends_df = await market_data_provider.get_fii_dividends_df(
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

        logger.info(f"Dividendos de {row['ticker']} na data {row['date']} consolidados com sucesso")


        logger.info(f"Dividendos de {row['ticker']} na data {row['date']} consolidados com sucesso")

