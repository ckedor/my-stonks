from collections.abc import Sequence
from datetime import date as date_type
from datetime import datetime, timedelta

import pandas as pd
from sqlalchemy import Date, Integer, and_, cast, desc, func, literal, or_, select
from sqlalchemy.orm import joinedload

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.market_data.domain.assets import (
    ETF,
    FII,
    Asset,
    AssetClass,
    AssetType,
    Broker,
    ETFSegment,
    Exchange,
    FIISegment,
    FIIType,
    FixedIncome,
    FixedIncomeType,
    Stock,
    TreasuryBond,
)
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.domain.market_data_series import MarketDataSeries
from app.modules.portfolio.domain.dividend import DividendQuery
from app.modules.portfolio.domain.entities import (
    CustomCategory,
    CustomCategoryAssignment,
    Dividend,
    Portfolio,
    PortfolioConsolidation,
    Position,
    ReturnSeries,
    Transaction,
)
from app.modules.portfolio.domain.portfolio_segment import SegmentDefinition
from app.modules.portfolio.domain.return_scope import WHOLE_PORTFOLIO_KEY, ReturnScope


def get_custom_category_subquery(portfolio_id):
    return (
        select(CustomCategoryAssignment.asset_id, CustomCategory.name.label('category'))
        .join(CustomCategory, CustomCategory.id == CustomCategoryAssignment.custom_category_id)
        .where(CustomCategory.portfolio_id == portfolio_id)
        .subquery()
    )


class PortfolioRepository(SQLAlchemyRepository):
    async def count_asset_references(self, asset_id: int) -> dict[str, int]:
        """Count the portfolio records that still point at an asset.

        Lives here because these are portfolio entities; asset deletion asks
        for it through the unit of work rather than querying them itself.
        """
        reference_models = {
            'transactions': Transaction,
            'positions': Position,
            'dividends': Dividend,
            'category_assignments': CustomCategoryAssignment,
        }
        references: dict[str, int] = {}
        for name, model in reference_models.items():
            count = await self.session.scalar(
                select(func.count()).select_from(model).where(model.asset_id == asset_id)
            )
            if count:
                references[name] = int(count)
        return references

    async def get_broker_currency_for_asset(
        self,
        portfolio_id: int,
        asset_id: int,
    ) -> int | None:
        stmt = (
            select(Broker.currency_id)
            .join(Transaction, Transaction.broker_id == Broker.id)
            .where(
                Transaction.asset_id == asset_id,
                Transaction.portfolio_id == portfolio_id,
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_most_recent_asset_ids_from_position(
        self,
        portfolio_id: int,
        delta_days: int | None = 1,
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
            .where(Position.quantity != 0)
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
            select(Transaction.asset_id).where(Transaction.portfolio_id == portfolio_id).distinct()
        )
        result = await self.session.execute(query)
        return list(result.scalars())

    async def get_all_asset_ids_with_transactions(
        self,
        asset_type_ids: Sequence[int] | None = None,
    ) -> list[int]:
        """Return distinct asset IDs referenced by any portfolio transaction."""
        stmt = select(Transaction.asset_id).distinct().order_by(Transaction.asset_id)
        if asset_type_ids:
            stmt = stmt.join(Asset, Asset.id == Transaction.asset_id).where(
                Asset.asset_type_id.in_(asset_type_ids)
            )
        result = await self.session.execute(stmt)
        return list(result.scalars())

    async def get_recent_position_asset_ids(
        self,
        *,
        window_days: int = 5,
        asset_type_ids: Sequence[int] | None = None,
    ) -> list[int]:
        """Return held assets from the latest global position window.

        The global maximum is intentional: a portfolio whose positions have
        not been refreshed recently must not make old holdings eligible for
        the daily quote ingestion.
        """
        latest_position_date = select(func.max(Position.date)).scalar_subquery()
        stmt = (
            select(Position.asset_id)
            .where(
                Position.date > latest_position_date - timedelta(days=window_days),
                Position.quantity != 0,
            )
            .distinct()
            .order_by(Position.asset_id)
        )
        if asset_type_ids:
            stmt = stmt.join(Asset, Asset.id == Position.asset_id).where(
                Asset.asset_type_id.in_(asset_type_ids)
            )
        result = await self.session.execute(stmt)
        return list(result.scalars())

    async def get_latest_position_date(self) -> date_type | None:
        """Return the most recent snapshot date available in position."""
        result = await self.session.execute(select(func.max(Position.date)))
        return result.scalar_one_or_none()

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
                func.sum(Transaction.quantity).label('quantity'),
            )
            .where(Transaction.portfolio_id == portfolio_id)
            .where(Transaction.date < end_exclusive)
            .group_by(Transaction.asset_id, Transaction.broker_id)
            .having(func.sum(Transaction.quantity) != 0)
            .subquery()
        )

        stmt = (
            select(
                cast(literal(search_date), Date).label('date'),
                txn_subq.c.asset_id,
                Asset.ticker,
                Asset.name,
                Broker.currency_id,
                txn_subq.c.quantity,
                Position.price,
                Position.twelve_months_return,
                Position.acc_return,
                Position.daily_return,
                Dividend.amount.label('dividend'),
                cat_assignment_subq.c.category,
                AssetType.short_name.label('type'),
                AssetType.id.label('type_id'),
                AssetClass.name.label('class'),
                Broker.id.label('broker_id'),
                Broker.name.label('broker_name'),
                Broker.cnpj.label('broker_cnpj'),
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
                .joinedload(MarketDataSeries.currency),
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

    async def get_all_portfolios(self) -> list[Portfolio]:
        """Every portfolio in the application, for administrative reads.

        Unlike ``get_user_portfolios`` this is not scoped to one user. The
        owner is carried as ``user_id``; resolving it to a person belongs to
        the users module.
        """
        result = await self.session.execute(select(Portfolio).order_by(Portfolio.name))
        return list(result.scalars().all())

    async def get_transactions(
        self,
        portfolio_id: int,
        asset_id: int | None = None,
        asset_types_ids: list[int] | None = None,
        currency_id: int | None = None,
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
        self, portfolio_id: int, filters: DividendQuery, currency: str = 'BRL'
    ) -> list[dict]:
        cat_assignment_subq = get_custom_category_subquery(portfolio_id)

        # `amount_usd` fica nulo em provento sem conversão, e o schema da rota
        # exige um número: sem o coalesce a lista inteira falha na visão dólar.
        amount_col = (
            func.coalesce(Dividend.amount_usd, 0.0).label('amount')
            if currency == 'USD'
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

    async def get_exempt_dividends_summary(
        self,
        portfolio_id: int,
        start_date: date_type,
        end_date: date_type,
        asset_type_ids: Sequence[int],
        currency: str = 'BRL',
    ) -> list[dict]:
        amount_col = Dividend.amount_usd if currency == 'USD' else Dividend.amount

        stmt = (
            select(
                Asset.id.label('asset_id'),
                Asset.ticker,
                AssetType.short_name.label('asset_type'),
                func.sum(amount_col).label('total_dividends'),
            )
            .join(Asset, Dividend.asset_id == Asset.id)
            .join(AssetType, Asset.asset_type_id == AssetType.id)
            .where(Dividend.portfolio_id == portfolio_id)
            .where(Dividend.date >= start_date)
            .where(Dividend.date <= end_date)
            .where(Asset.asset_type_id.in_(asset_type_ids))
            .group_by(Asset.id, Asset.ticker, AssetType.short_name)
            .order_by(desc(func.sum(amount_col)))
        )

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
                Asset.asset_type_id,
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

    async def get_segment_asset_ids(
        self, portfolio_id: int, definition: SegmentDefinition
    ) -> list[int]:
        """Every asset of a portfolio that belongs to a segment.

        Membership is a property of the asset, not of today's position, so an
        asset already sold stays in the list: the segment's return series is a
        history and it has to include what was held along the way.
        """
        stmt = (
            select(Position.asset_id)
            .join(Asset, Position.asset_id == Asset.id)
            .outerjoin(Exchange, Asset.exchange_id == Exchange.id)
            .where(Position.portfolio_id == portfolio_id)
            # Por id, e não por `short_name`: aquela coluna é rótulo de produto
            # em pt-BR ("Ação", "Tesouro", "Cripto"), e casá-la com um código
            # em inglês funcionava só para os tipos em que os dois coincidem.
            .where(Asset.asset_type_id.in_(definition.asset_type_ids))
            .distinct()
        )

        if definition.brazilian_exchange is not None:
            # Sem bolsa é brasileiro: é como ficam registrados o Tesouro, o CDB
            # e tudo que não tem código em bolsa nenhuma.
            in_brazil = or_(Exchange.code == EXCHANGE.B3.value, Asset.exchange_id.is_(None))
            stmt = stmt.where(in_brazil if definition.brazilian_exchange else ~in_brazil)

        result = await self.session.execute(stmt)
        return [row[0] for row in result.all()]

    @staticmethod
    def _return_series_columns(currency: str):
        """The series columns, restated for the requested currency.

        Every scope stores both currencies side by side, so choosing one is
        picking three columns rather than filtering rows.
        """
        suffix = '_usd' if currency == 'USD' else ''
        return (
            ReturnSeries.date,
            getattr(ReturnSeries, f'daily_return{suffix}').label('daily_return'),
            getattr(ReturnSeries, f'acc_return{suffix}').label('acc_return'),
            getattr(ReturnSeries, f'cagr{suffix}').label('cagr'),
        )

    async def get_return_series(
        self,
        portfolio_id: int,
        *,
        scope: str,
        scope_key: str,
        currency: str = 'BRL',
    ) -> list[dict]:
        """One consolidated series, whatever it is about."""
        stmt = (
            select(*self._return_series_columns(currency))
            .where(ReturnSeries.portfolio_id == portfolio_id)
            .where(ReturnSeries.scope == str(scope))
            .where(ReturnSeries.scope_key == scope_key)
            .order_by(ReturnSeries.date)
        )
        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_asset_type_return_series(
        self,
        portfolio_id: int,
        asset_type_id: int,
        currency: str = 'BRL',
    ) -> list[dict]:
        """The asset-type series, carrying the type's id and label as before.

        `scope_key` is text for every scope, so reaching the asset type costs a
        cast. The portfolio and scope predicates narrow the rows first, and the
        cast only applies to what survives them.
        """
        stmt = (
            select(
                *self._return_series_columns(currency),
                cast(ReturnSeries.scope_key, Integer).label('asset_type_id'),
                AssetType.short_name.label('asset_type'),
            )
            .join(AssetType, AssetType.id == cast(ReturnSeries.scope_key, Integer))
            .where(ReturnSeries.portfolio_id == portfolio_id)
            .where(ReturnSeries.scope == str(ReturnScope.ASSET_TYPE))
            .where(ReturnSeries.scope_key == str(asset_type_id))
            .order_by(ReturnSeries.date)
        )
        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_portfolio_position(  # noqa: PLR0913
        self,
        portfolio_id: int,
        start_date=None,
        end_date=None,
        asset_id=None,
        asset_type_id=None,
        asset_type_ids=None,
        asset_ids: list[int] | None = None,
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
                Asset.asset_type_id,
                Asset.ticker,
                Position.quantity,
                Position.price,
                Position.price_usd,
                Position.average_price,
                dividend_subquery.c.total_dividend.label('dividend'),
                dividend_subquery.c.total_dividend_usd.label('dividend_usd'),
                cat_assignment_subq.c.category,
                # O consolidador precisa dela para resolver o segmento: os dois
                # segmentos de ação são o mesmo tipo de ativo separado por bolsa.
                Exchange.code.label('exchange'),
            )
            .join(Asset, Position.asset_id == Asset.id)
            .outerjoin(Exchange, Asset.exchange_id == Exchange.id)
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
        asset_type_id: int | None = None,
        currency: str = 'BRL',
    ):
        if date:
            search_date = date
        else:
            search_date = await self._get_portfolio_position_latest_date(portfolio_id)

        cat_assignment_subq = get_custom_category_subquery(portfolio_id)

        price_col = Position.price_usd.label('price') if currency == 'USD' else Position.price
        total_invested_col = (
            Position.total_invested_usd.label('total_invested')
            if currency == 'USD'
            else Position.total_invested
        )

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
                # Onde o papel é negociado. Vem junto porque é o que separa a
                # ação brasileira da estrangeira -- mesmo tipo de ativo, telas
                # diferentes -- e a tela não tem outro jeito de saber.
                Exchange.code.label('exchange'),
                FIISegment.name.label('fii_segment'),
                FIIType.name.label('fii_type'),
                # O que uma ação e um ETF publicam sobre si: as dimensões pelas
                # quais a concentração da carteira é lida nas telas por tipo.
                Stock.sector,
                Stock.industry,
                Stock.country,
                ETFSegment.name.label('etf_segment'),
                # O que remunera um papel de renda fixa: indexador, taxa e a
                # forma de combinar os dois (prefixado, index+, %index). Nulo
                # para todo o resto, que é a maioria das linhas.
                MarketDataSeries.short_name.label('index'),
                FixedIncome.fee.label('fee'),
                FixedIncomeType.id.label('fixed_income_type_id'),
                FixedIncomeType.name.label('fixed_income_type'),
            )
            .join(Asset, Position.asset_id == Asset.id)
            .outerjoin(cat_assignment_subq, cat_assignment_subq.c.asset_id == Position.asset_id)
            .join(AssetType, Asset.asset_type_id == AssetType.id)
            .join(AssetClass, AssetType.asset_class_id == AssetClass.id)
            .outerjoin(Exchange, Asset.exchange_id == Exchange.id)
            .outerjoin(Stock, Stock.asset_id == Asset.id)
            .outerjoin(ETF, ETF.asset_id == Asset.id)
            .outerjoin(ETFSegment, ETFSegment.id == ETF.segment_id)
            .outerjoin(FII, FII.asset_id == Asset.id)
            .outerjoin(FIISegment, FIISegment.id == FII.segment_id)
            .outerjoin(FIIType, FIIType.id == FIISegment.type_id)
            .outerjoin(FixedIncome, FixedIncome.asset_id == Asset.id)
            .outerjoin(MarketDataSeries, FixedIncome.index_id == MarketDataSeries.id)
            .outerjoin(FixedIncomeType, FixedIncome.fixed_income_type_id == FixedIncomeType.id)
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

    async def _get_portfolio_position_latest_date(self, portfolio_id: int):
        latest_date_stmt = select(func.max(Position.date)).where(
            Position.portfolio_id == portfolio_id
        )
        latest_date_result = await self.session.execute(latest_date_stmt)
        latest_date = latest_date_result.scalar_one_or_none()

        if not latest_date:
            return None

        return pd.to_datetime(latest_date)

    async def get_asset_category(self, portfolio_id: int, asset_id: int) -> CustomCategory | None:
        """Returns the CustomCategory (with benchmark) for an asset in a portfolio."""
        stmt = (
            select(CustomCategory)
            .join(
                CustomCategoryAssignment,
                CustomCategoryAssignment.custom_category_id == CustomCategory.id,
            )
            .where(CustomCategory.portfolio_id == portfolio_id)
            .where(CustomCategoryAssignment.asset_id == asset_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_asset_category_by_id(self, custom_category_id: int) -> CustomCategory | None:
        """Returns a CustomCategory by its ID."""
        stmt = select(CustomCategory).where(CustomCategory.id == custom_category_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_assets_from_current_position(self, portfolio_id: int) -> list[int]:
        stmt = (
            select(Asset.ticker)
            .join(Position, Position.asset_id == Asset.id)
            .where(
                Position.date
                == select(func.max(Position.date))
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
        asset_ids: list[int] | None = None,
    ) -> list[dict]:
        div_q = (
            select(
                Dividend.asset_id.label('asset_id'),
                Dividend.portfolio_id.label('portfolio_id'),
                Dividend.date.label('date'),
                func.sum(Dividend.amount).label('dividend_amount'),
            )
            .where(Dividend.portfolio_id == portfolio_id)
            .group_by(Dividend.asset_id, Dividend.portfolio_id, Dividend.date)
        )
        if asset_ids:
            div_q = div_q.where(Dividend.asset_id.in_(asset_ids))
        divs = div_q.subquery('divs')

        tx_q = (
            select(
                Transaction.asset_id.label('asset_id'),
                Transaction.portfolio_id.label('portfolio_id'),
                Transaction.date.label('date'),
                func.sum(Transaction.quantity).label('transaction_quantity'),
            )
            .where(Transaction.portfolio_id == portfolio_id)
            .group_by(Transaction.asset_id, Transaction.portfolio_id, Transaction.date)
        )
        if asset_ids:
            tx_q = tx_q.where(Transaction.asset_id.in_(asset_ids))
        txs = tx_q.subquery('txs')

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
                Asset.ticker.label('ticker'),
                func.coalesce(divs.c.dividend_amount, 0).label('dividend_amount'),
                func.coalesce(txs.c.transaction_quantity, 0).label('transaction_quantity'),
                cats.c.category.label('category'),
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

    async def delete_return_series(
        self,
        portfolio_id: int,
        *,
        scope: str | None = None,
        scope_key: str | None = None,
    ) -> None:
        """Remove a portfolio's series, or just one scope of it.

        `scope_key` is text and points at a different table per scope, so it
        cannot be a foreign key and nothing cascades. Deleting the row it refers
        to has to come here, or the series outlives what it was about.
        """
        criteria: dict = {'portfolio_id': portfolio_id}
        if scope is not None:
            criteria['scope'] = str(scope)
        if scope_key is not None:
            criteria['scope_key'] = scope_key
        await self.delete(ReturnSeries, by=criteria)

    async def get_consolidation(self, portfolio_id: int) -> PortfolioConsolidation | None:
        """When this portfolio's derived data was last rebuilt, if ever."""
        return await self.get(
            PortfolioConsolidation,
            by={'portfolio_id': portfolio_id},
            first=True,
        )

    async def get_portfolio_returns(self, portfolio_id: int, currency: str = 'BRL') -> list[dict]:
        return await self.get_return_series(
            portfolio_id,
            scope=ReturnScope.PORTFOLIO,
            scope_key=WHOLE_PORTFOLIO_KEY,
            currency=currency,
        )

    async def get_category_returns(
        self,
        portfolio_id: int,
        custom_category_id: int | None = None,
        most_recent: bool = False,
        currency: str = 'BRL',
    ) -> list[dict]:
        """Category series, carrying the category id and name as before.

        `most_recent` keeps only each category's last day, which is what the
        allocation screen reads: one row per category rather than a history.
        """
        category_id = cast(ReturnSeries.scope_key, Integer)
        stmt = (
            select(
                *self._return_series_columns(currency),
                category_id.label('custom_category_id'),
                CustomCategory.name.label('category'),
            )
            .join(CustomCategory, CustomCategory.id == category_id)
            .where(ReturnSeries.portfolio_id == portfolio_id)
            .where(ReturnSeries.scope == str(ReturnScope.CATEGORY))
        )
        if custom_category_id:
            stmt = stmt.where(ReturnSeries.scope_key == str(custom_category_id))

        if most_recent:
            last_day = (
                select(
                    ReturnSeries.scope_key,
                    func.max(ReturnSeries.date).label('max_date'),
                )
                .where(ReturnSeries.portfolio_id == portfolio_id)
                .where(ReturnSeries.scope == str(ReturnScope.CATEGORY))
            )
            if custom_category_id:
                last_day = last_day.where(ReturnSeries.scope_key == str(custom_category_id))
            last_day = last_day.group_by(ReturnSeries.scope_key).subquery()
            stmt = stmt.join(
                last_day,
                (ReturnSeries.scope_key == last_day.c.scope_key)
                & (ReturnSeries.date == last_day.c.max_date),
            )
        else:
            stmt = stmt.order_by(ReturnSeries.date)

        result = await self.session.execute(stmt)
        return result.mappings().all()
