from datetime import date as date_type
from datetime import datetime, timedelta
from typing import List, Optional

import pandas as pd
from app.infra.db.models.asset import Asset, AssetClass, AssetType
from app.infra.db.models.asset_etf import ETF
from app.infra.db.models.asset_fii import FII, FIISegment
from app.infra.db.models.asset_fixed_income import FixedIncome
from app.infra.db.models.asset_treasury_bond import TreasuryBond
from app.infra.db.models.market_data import Index
from app.infra.db.models.portfolio import (
    Broker,
    CategoryReturn,
    CustomCategory,
    CustomCategoryAssignment,
    Dividend,
    Portfolio,
    PortfolioReturn,
    Position,
    Transaction,
)
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from sqlalchemy import Date, and_, cast, desc, func, literal, select
from sqlalchemy.orm import joinedload


def get_custom_category_subquery(portfolio_id):
    return (
        select(CustomCategoryAssignment.asset_id, CustomCategory.name.label('category'))
        .join(CustomCategory, CustomCategory.id == CustomCategoryAssignment.custom_category_id)
        .where(CustomCategory.portfolio_id == portfolio_id)
        .subquery()
    )


class PortfolioRepository(SQLAlchemyRepository):
    
    async def get_most_recent_asset_ids_from_position(
        self,
        portfolio_id: int, 
        delta_days: Optional[int] = 1,
        ) -> list[int]:
        """
        Returns a list of asset_ids from the most recent asset position 
        """
        most_recent_date_subquery = (
            select(func.max(Position.date))
            .where(Position.portfolio_id == portfolio_id)
            .scalar_subquery()
        )
        query = (
            select(Position.asset_id)
            .where(Position.portfolio_id == portfolio_id)
            .where(Position.date > most_recent_date_subquery - timedelta(days=delta_days))
            .distinct()
        )  
        
        result = await self.session.execute(query)
        rows = result.scalars()
        return list(rows)
    
    async def get_asset_ids_with_transactions(
        self,
        portfolio_id: int,
    ) -> list[int]:
        """Returns the distinct asset_ids that have transactions in the portfolio."""
        query = (
            select(Transaction.asset_id)
            .where(Transaction.portfolio_id == portfolio_id)
            .distinct()
        )
        result = await self.session.execute(query)
        return list(result.scalars())
    
    
    async def get_position_on_date_by_broker(
        self,
        portfolio_id: int,
        date: date_type | datetime | None = None,
        asset_type_id: int | None = None,
    ) -> list[dict]:
        """
        Retorna as linhas da posição do portfólio agrupadas por corretora (broker),
        somando as quantities das transactions até a data (ignorando horário).

        Each row is a mapping; conversion to DataFrame is the caller's responsibility.
        """
        if date is None:
            search_date = await self._get_portfolio_position_latest_date(portfolio_id)
        else:
            search_date = date

        if isinstance(search_date, datetime):
            search_date = search_date.date()

        end_exclusive = search_date + timedelta(days=1)

        cat_assignment_subq = get_custom_category_subquery(portfolio_id)

        txn_subq = (
            select(
                Transaction.asset_id,
                Transaction.broker_id,
                func.sum(Transaction.quantity).label("quantity"),
            )
            .where(Transaction.portfolio_id == portfolio_id)
            .where(Transaction.date < end_exclusive)
            .group_by(Transaction.asset_id, Transaction.broker_id)
            .having(func.sum(Transaction.quantity) != 0)
            .subquery()
        )

        stmt = (
            select(
                cast(literal(search_date), Date).label("date"),
                txn_subq.c.asset_id,
                Asset.ticker,
                Asset.name,
                Broker.currency_id,
                txn_subq.c.quantity,
                Position.price,
                Position.twelve_months_return,
                Position.acc_return,
                Position.daily_return,
                Dividend.amount.label("dividend"),
                cat_assignment_subq.c.category,
                AssetType.short_name.label("type"),
                AssetType.id.label("type_id"),
                AssetClass.name.label("class"),
                Broker.id.label("broker_id"),
                Broker.name.label("broker_name"),
                Broker.cnpj.label("broker_cnpj"),
            )
            .join(Asset, Asset.id == txn_subq.c.asset_id)
            .join(Broker, Broker.id == txn_subq.c.broker_id)
            .join(AssetType, Asset.asset_type_id == AssetType.id)
            .join(AssetClass, AssetType.asset_class_id == AssetClass.id)
            .outerjoin(cat_assignment_subq, cat_assignment_subq.c.asset_id == Asset.id)
            .join(
                Position,
                and_(
                    Position.portfolio_id == portfolio_id,
                    Position.asset_id == txn_subq.c.asset_id,
                    Position.date == search_date,
                ),
            )
            .outerjoin(
                Dividend,
                and_(
                    Dividend.asset_id == txn_subq.c.asset_id,
                    Dividend.date == search_date,
                    Dividend.portfolio_id == portfolio_id,
                ),
            )
        )

        if asset_type_id is not None:
            stmt = stmt.where(Asset.asset_type_id == asset_type_id)

        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_asset_details(self, asset_id: int):
        stmt = (
            select(Asset)
            .options(
                joinedload(Asset.asset_type).joinedload(AssetType.asset_class),
                joinedload(Asset.stock),
                joinedload(Asset.fii).joinedload(FII.segment).joinedload(FIISegment.type),
                joinedload(Asset.etf).joinedload(ETF.segment),
                joinedload(Asset.fund),
                joinedload(Asset.fixed_income)
                .joinedload(FixedIncome.index)
                .joinedload(Index.currency),
                joinedload(Asset.fixed_income).joinedload(FixedIncome.fixed_income_type),
                joinedload(Asset.treasury_bond).joinedload(TreasuryBond.type),
            )
            .where(Asset.id == asset_id)
        )

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_portfolios(self, user_id: int):
        stmt = (
            select(Portfolio)
            .where(Portfolio.user_id == user_id)
            .options(joinedload(Portfolio.custom_categories))
        )
        result = await self.session.execute(stmt)
        return result.unique().scalars().all()

    async def get_transactions(
        self,
        portfolio_id: int,
        asset_id: Optional[int] = None,
        asset_types_ids: Optional[List[int]] = None,
        currency_id: Optional[int] = None,
    ) -> list[dict]:
        cat_assignment_subq = get_custom_category_subquery(portfolio_id)

        stmt = (
            select(
                Transaction.id,
                Transaction.date,
                Transaction.quantity,
                Broker.id.label('broker_id'),
                Broker.name.label('broker'),
                Broker.currency_id.label('currency_id'),
                Transaction.price,
                Transaction.price_usd,
                Asset.id.label('asset_id'),
                Asset.ticker,
                Asset.asset_type_id,
                cat_assignment_subq.c.category,
            )
            .join(Asset, Transaction.asset_id == Asset.id)
            .join(Broker, Transaction.broker_id == Broker.id)
            .outerjoin(cat_assignment_subq, cat_assignment_subq.c.asset_id == Asset.id)
            .where(Transaction.portfolio_id == portfolio_id)
            .order_by(Transaction.date)
        )

        if asset_types_ids:
            stmt = stmt.where(Asset.asset_type_id.in_(asset_types_ids))
        elif asset_id:
            stmt = stmt.where(Transaction.asset_id == asset_id)
        if currency_id:
            stmt = stmt.where(Broker.currency_id == currency_id)

        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_portfolio_dividends(
        self, portfolio_id: int, filters, currency: str = 'BRL'
    ) -> list[dict]:
        cat_assignment_subq = get_custom_category_subquery(portfolio_id)

        amount_col = (
            Dividend.amount_usd.label('amount') if currency == 'USD'
            else Dividend.amount
        )

        stmt = (
            select(
                Dividend.id,
                Dividend.date,
                Dividend.asset_id,
                Asset.ticker,
                amount_col,
                cat_assignment_subq.c.category,
            )
            .join(Asset, Dividend.asset_id == Asset.id)
            .outerjoin(cat_assignment_subq, cat_assignment_subq.c.asset_id == Asset.id)
            .where(Dividend.portfolio_id == portfolio_id)
        )

        if filters.start_date:
            stmt = stmt.where(Dividend.date >= filters.start_date)
        if filters.end_date:
            stmt = stmt.where(Dividend.date <= filters.end_date)
        if filters.asset_id:
            stmt = stmt.where(Dividend.asset_id == filters.asset_id)
        if filters.asset_type_ids:
            stmt = stmt.where(Asset.asset_type_id.in_(filters.asset_type_ids))

        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_asset_position(
        self, portfolio_id: int, asset_ids: list[int], start_date=None, end_date=None
    ) -> list[dict]:
        dividend_subquery = (
            select(
                Dividend.asset_id,
                Dividend.portfolio_id,
                Dividend.date,
                func.sum(Dividend.amount).label('total_dividend'),
                func.sum(Dividend.amount_usd).label('total_dividend_usd'),
            )
            .where(Dividend.portfolio_id == portfolio_id)
            .where(Dividend.asset_id.in_(asset_ids))
            .group_by(Dividend.asset_id, Dividend.portfolio_id, Dividend.date)
            .subquery()
        )

        stmt = (
            select(
                Position.date,
                Position.asset_id,
                Asset.ticker,
                Position.quantity,
                Position.price,
                Position.price_usd,
                Position.twelve_months_return,
                func.coalesce(dividend_subquery.c.total_dividend, 0).label('dividend'),
                func.coalesce(dividend_subquery.c.total_dividend_usd, 0).label('dividend_usd'),
            )
            .join(Asset, Position.asset_id == Asset.id)
            .outerjoin(
                dividend_subquery,
                and_(
                    dividend_subquery.c.asset_id == Position.asset_id,
                    dividend_subquery.c.date == Position.date,
                    dividend_subquery.c.portfolio_id == Position.portfolio_id,
                ),
            )
            .where(Position.portfolio_id == portfolio_id)
            .where(Position.asset_id.in_(asset_ids))
        )

        if start_date:
            stmt = stmt.where(Position.date >= start_date)
        if end_date:
            stmt = stmt.where(Position.date <= end_date)

        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_portfolio_position(
        self,
        portfolio_id: int,
        start_date=None,
        end_date=None,
        asset_id=None,
        asset_type_id=None,
        asset_type_ids=None,
        asset_ids: Optional[List[int]] = None,
    ) -> list[dict]:
        dividend_subquery = (
            select(
                Dividend.asset_id,
                Dividend.portfolio_id,
                Dividend.date,
                func.sum(Dividend.amount).label('total_dividend'),
                func.sum(Dividend.amount_usd).label('total_dividend_usd'),
            )
            .where(Dividend.portfolio_id == portfolio_id)
            .group_by(Dividend.asset_id, Dividend.portfolio_id, Dividend.date)
            .subquery()
        )

        cat_assignment_subq = get_custom_category_subquery(portfolio_id)

        stmt = (
            select(
                Position.date,
                Position.asset_id,
                Asset.ticker,
                Position.quantity,
                Position.price,
                Position.price_usd,
                Position.average_price,
                dividend_subquery.c.total_dividend.label('dividend'),
                dividend_subquery.c.total_dividend_usd.label('dividend_usd'),
                cat_assignment_subq.c.category,
            )
            .join(Asset, Position.asset_id == Asset.id)
            .outerjoin(
                dividend_subquery,
                and_(
                    dividend_subquery.c.asset_id == Position.asset_id,
                    dividend_subquery.c.date == Position.date,
                    dividend_subquery.c.portfolio_id == Position.portfolio_id,
                ),
            )
            .outerjoin(cat_assignment_subq, cat_assignment_subq.c.asset_id == Position.asset_id)
            .where(Position.portfolio_id == portfolio_id)
            .order_by(Position.date)
        )

        if start_date:
            stmt = stmt.where(Position.date >= start_date)
        if end_date:
            stmt = stmt.where(Position.date <= end_date)
        if asset_id:
            stmt = stmt.where(Position.asset_id == asset_id)
        if asset_ids:
            stmt = stmt.where(Position.asset_id.in_(asset_ids))
        if asset_type_id:
            stmt = stmt.where(Asset.asset_type_id == asset_type_id)
        if asset_type_ids:
            stmt = stmt.where(Asset.asset_type_id.in_(asset_type_ids))

        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_position_on_date(
        self, portfolio_id, date=None, asset_type_id=None, currency='BRL'
    ) -> list[dict]:
        stmt = await self._build_portfolio_position_query(
            portfolio_id, date, asset_type_id, currency=currency
        )

        result = await self.session.execute(stmt)
        return result.mappings().all()
    
    async def _build_portfolio_position_query(
        self,
        portfolio_id: int,
        date: pd.Timestamp = None,
        asset_type_id: int = None,
        currency: str = 'BRL',
    ):

        if date:
            search_date = date
        else:
            search_date = await self._get_portfolio_position_latest_date(portfolio_id)
        
        cat_assignment_subq = get_custom_category_subquery(portfolio_id)

        price_col = Position.price_usd.label('price') if currency == 'USD' else Position.price
        total_invested_col = Position.total_invested_usd.label('total_invested') if currency == 'USD' else Position.total_invested
        
        stmt = (
            select(
                Position.date,
                Position.asset_id,
                Asset.ticker,
                Asset.name,
                Position.quantity,
                price_col,
                Position.twelve_months_return,
                Position.acc_return,
                Position.daily_return,
                Position.cagr,
                total_invested_col,
                Dividend.amount.label('dividend'),
                cat_assignment_subq.c.category,
                AssetType.short_name.label('type'),
                AssetType.id.label('type_id'),
                AssetClass.name.label('class'),
            )
            .join(Asset, Position.asset_id == Asset.id)
            .outerjoin(cat_assignment_subq, cat_assignment_subq.c.asset_id == Position.asset_id)
            .join(AssetType, Asset.asset_type_id == AssetType.id)
            .join(AssetClass, AssetType.asset_class_id == AssetClass.id)
            .outerjoin(
                Dividend,
                and_(
                    Dividend.asset_id == Position.asset_id,
                    Dividend.date == Position.date,
                    Dividend.portfolio_id == Position.portfolio_id,
                ),
            )
            .where(Position.portfolio_id == portfolio_id)
            .where(Position.date == search_date)
            .order_by(Position.date)
        )
        
        if asset_type_id:
            stmt = stmt.where(Asset.asset_type_id == asset_type_id)
        
        return stmt
        
    async def _get_portfolio_position_latest_date(
        self,
        portfolio_id: int):
        
        latest_date_stmt = select(func.max(Position.date)).where(
            Position.portfolio_id == portfolio_id
        )
        latest_date_result = await self.session.execute(latest_date_stmt)
        latest_date = latest_date_result.scalar_one_or_none()

        if not latest_date:
            return None

        return pd.to_datetime(latest_date)

    async def get_asset_category(
        self, portfolio_id: int, asset_id: int
    ) -> Optional[CustomCategory]:
        """Returns the CustomCategory (with benchmark) for an asset in a portfolio."""
        stmt = (
            select(CustomCategory)
            .join(CustomCategoryAssignment, CustomCategoryAssignment.custom_category_id == CustomCategory.id)
            .where(CustomCategory.portfolio_id == portfolio_id)
            .where(CustomCategoryAssignment.asset_id == asset_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_asset_category_by_id(
        self, custom_category_id: int
    ) -> Optional[CustomCategory]:
        """Returns a CustomCategory by its ID."""
        stmt = select(CustomCategory).where(CustomCategory.id == custom_category_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_assets_from_current_position(
        self, portfolio_id: int
    ) -> List[int]:
        
        stmt = (
            select(Asset.ticker)
            .join(Position, Position.asset_id == Asset.id)
            .where(
                Position.date == select(func.max(Position.date))
                .where(Position.portfolio_id == portfolio_id)
                .scalar_subquery()
            )
            .where(Position.portfolio_id == portfolio_id)
            .distinct()
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all() if row[0] is not None]

    async def get_complete_portfolio_position_history(
        self,
        portfolio_id: int,
        asset_ids: Optional[List[int]] = None,
    ) -> list[dict]:
        div_q = (
            select(
                Dividend.asset_id.label("asset_id"),
                Dividend.portfolio_id.label("portfolio_id"),
                Dividend.date.label("date"),
                func.sum(Dividend.amount).label("dividend_amount"),
            )
            .where(Dividend.portfolio_id == portfolio_id)
            .group_by(Dividend.asset_id, Dividend.portfolio_id, Dividend.date)
        )
        if asset_ids:
            div_q = div_q.where(Dividend.asset_id.in_(asset_ids))
        divs = div_q.subquery("divs")
        
        tx_q = (
            select(
                Transaction.asset_id.label("asset_id"),
                Transaction.portfolio_id.label("portfolio_id"),
                Transaction.date.label("date"),
                func.sum(Transaction.quantity).label("transaction_quantity"),
            )
            .where(Transaction.portfolio_id == portfolio_id)
            .group_by(Transaction.asset_id, Transaction.portfolio_id, Transaction.date)
        )
        if asset_ids:
            tx_q = tx_q.where(Transaction.asset_id.in_(asset_ids))
        txs = tx_q.subquery("txs")

        cats = get_custom_category_subquery(portfolio_id)


        stmt = (
            select(
                Position.date,
                Position.portfolio_id,
                Position.asset_id,
                Position.quantity,

                Position.price,
                Position.average_price,
                Position.daily_return,
                Position.acc_return,
                Position.twelve_months_return,

                Position.price_usd,
                Position.average_price_usd,
                Position.daily_return_usd,
                Position.acc_return_usd,
                Position.twelve_months_return_usd,

                Asset.ticker.label("ticker"),
                func.coalesce(divs.c.dividend_amount, 0).label("dividend_amount"),
                func.coalesce(txs.c.transaction_quantity, 0).label("transaction_quantity"),
                cats.c.category.label("category"),
            )
            .join(Asset, Asset.id == Position.asset_id)
            .outerjoin(
                divs,
                and_(
                    divs.c.portfolio_id == Position.portfolio_id,
                    divs.c.asset_id == Position.asset_id,
                    divs.c.date == Position.date,
                ),
            )
            .outerjoin(
                txs,
                and_(
                    txs.c.portfolio_id == Position.portfolio_id,
                    txs.c.asset_id == Position.asset_id,
                    txs.c.date == Position.date,
                ),
            )
            .outerjoin(
                cats,
                cats.c.asset_id == Position.asset_id,
            )
            .where(Position.portfolio_id == portfolio_id)
            .order_by(Position.date, Position.asset_id)
        )

        if asset_ids:
            stmt = stmt.where(Position.asset_id.in_(asset_ids))

        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_portfolio_returns(
        self, portfolio_id: int, currency: str = 'BRL'
    ) -> list[dict]:
        suffix = '_usd' if currency == 'USD' else ''
        daily_col = getattr(PortfolioReturn, f'daily_return{suffix}')
        acc_col = getattr(PortfolioReturn, f'acc_return{suffix}')
        cagr_col = getattr(PortfolioReturn, f'cagr{suffix}')

        stmt = (
            select(
                PortfolioReturn.date,
                daily_col.label('daily_return'),
                acc_col.label('acc_return'),
                cagr_col.label('cagr'),
            )
            .where(PortfolioReturn.portfolio_id == portfolio_id)
            .order_by(PortfolioReturn.date)
        )
        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_category_returns(
        self,
        portfolio_id: int,
        custom_category_id: int = None,
        most_recent: bool = False,
        currency: str = 'BRL',
    ) -> list[dict]:
        suffix = '_usd' if currency == 'USD' else ''
        daily_col = getattr(CategoryReturn, f'daily_return{suffix}')
        acc_col = getattr(CategoryReturn, f'acc_return{suffix}')
        cagr_col = getattr(CategoryReturn, f'cagr{suffix}')

        if most_recent:
            # Subquery to get the max date per category
            max_date_sq = (
                select(
                    CategoryReturn.custom_category_id,
                    func.max(CategoryReturn.date).label('max_date'),
                )
                .where(CategoryReturn.portfolio_id == portfolio_id)
                .group_by(CategoryReturn.custom_category_id)
            )
            if custom_category_id:
                max_date_sq = max_date_sq.where(CategoryReturn.custom_category_id == custom_category_id)
            max_date_sq = max_date_sq.subquery()

            stmt = (
                select(
                    CategoryReturn.date,
                    CategoryReturn.custom_category_id,
                    CustomCategory.name.label('category'),
                    daily_col.label('daily_return'),
                    acc_col.label('acc_return'),
                    cagr_col.label('cagr'),
                )
                .join(CustomCategory, CustomCategory.id == CategoryReturn.custom_category_id)
                .join(
                    max_date_sq,
                    (CategoryReturn.custom_category_id == max_date_sq.c.custom_category_id)
                    & (CategoryReturn.date == max_date_sq.c.max_date),
                )
                .where(CategoryReturn.portfolio_id == portfolio_id)
            )
            result = await self.session.execute(stmt)
            return result.mappings().all()

        stmt = (
            select(
                CategoryReturn.date,
                CategoryReturn.custom_category_id,
                CustomCategory.name.label('category'),
                daily_col.label('daily_return'),
                acc_col.label('acc_return'),
                cagr_col.label('cagr'),
            )
            .join(CustomCategory, CustomCategory.id == CategoryReturn.custom_category_id)
            .where(CategoryReturn.portfolio_id == portfolio_id)
            .order_by(CategoryReturn.date)
        )
        if custom_category_id:
            stmt = stmt.where(CategoryReturn.custom_category_id == custom_category_id)

        result = await self.session.execute(stmt)
        return result.mappings().all()

