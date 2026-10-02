# app/modules/portfolio/service/portfolio_income_tax_service.py
"""
Imposto de renda: a apuração do contribuinte e as fichas da declaração.

A apuração é do usuário — todas as carteiras dele —, e o cálculo mora em
`domain/income_tax/`. Aqui só se leem os fatos pelo unit of work, se traduzem
para o motor e se registram os pagamentos de DARF.
"""

from datetime import date
from decimal import Decimal

from app.core.exceptions import NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.domain.income_tax.darf import DarfPayment
from app.modules.portfolio.domain.income_tax.declaration import (
    AssetRecord,
    BrokerRecord,
    DividendRecord,
)
from app.modules.portfolio.domain.income_tax.report import IncomeTaxReport, assess
from app.modules.portfolio.domain.income_tax.rules import FOREIGN_RULES
from app.modules.portfolio.domain.income_tax.trades import (
    AssetFacts,
    CorporateEvent,
    TaxTrade,
    classify,
)


class PortfolioIncomeTaxService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def get_assessment(
        self, user_id: int, fiscal_year: int, today: date | None = None
    ) -> IncomeTaxReport:
        """A apuração do ano-calendário, sobre todas as carteiras do usuário."""
        async with self.uow as uow:
            portfolios = await uow.portfolios.get_user_portfolios(user_id)
            portfolio_ids = [portfolio.id for portfolio in portfolios]
            rows = await uow.portfolios.get_income_tax_trades(portfolio_ids)
            events = await uow.portfolios.get_events_for_assets(
                sorted({row['asset_id'] for row in rows})
            )
            payments = await uow.portfolios.get_darf_payments(user_id)
            # O exterior leva perda de um ano ao seguinte desde a lei, e os
            # dividendos de cada ano entram nessa conta.
            first_year = min([fiscal_year, *(rule.valid_from.year for rule in FOREIGN_RULES)])
            dividend_rows = await uow.portfolios.get_income_tax_dividends(
                portfolio_ids, date(first_year, 1, 1), date(fiscal_year, 12, 31)
            )

        return assess(
            fiscal_year=fiscal_year,
            trades=[_tax_trade(row) for row in rows],
            events=[
                CorporateEvent(
                    asset_id=event.asset_id,
                    day=event.date,
                    type=event.type,
                    factor=_decimal(event.factor),
                )
                for event in events
            ],
            payments=payments,
            today=today or date.today(),
            assets={row['asset_id']: _asset_record(row) for row in rows},
            brokers={row['broker_id']: _broker_record(row) for row in rows},
            dividends=[
                DividendRecord(
                    asset_id=row['asset_id'],
                    day=row['date'],
                    amount=_decimal(row['amount']),
                    kind=row['kind'],
                )
                for row in dividend_rows
            ],
        )

    async def list_darf_payments(self, user_id: int) -> list[DarfPayment]:
        async with self.uow as uow:
            return await uow.portfolios.get_darf_payments(user_id)

    async def register_darf_payment(  # noqa: PLR0913
        self,
        user_id: int,
        *,
        revenue_code: str,
        period: date,
        paid_on: date,
        principal: Decimal,
        fine: Decimal = Decimal(0),
        interest: Decimal = Decimal(0),
    ) -> DarfPayment:
        payment = DarfPayment(
            user_id=user_id,
            revenue_code=revenue_code,
            period=period.replace(day=1),
            paid_on=paid_on,
            principal=principal,
            fine=fine,
            interest=interest,
        )
        async with self.uow as uow:
            await uow.portfolios.create(DarfPayment, [payment])
            await uow.commit()
        return payment

    async def delete_darf_payment(self, user_id: int, payment_id: int) -> None:
        async with self.uow as uow:
            payment = await uow.portfolios.get(DarfPayment, id=payment_id)
            if payment is None or payment.user_id != user_id:
                raise NotFoundError(
                    'Pagamento de DARF não encontrado', context={'payment_id': payment_id}
                )
            await uow.portfolios.delete(DarfPayment, id=payment_id)
            await uow.commit()


def _decimal(value) -> Decimal:
    """Float do banco para Decimal pelo texto, sem o ruído binário (0.1 vira 0.1)."""
    return Decimal(str(value))


def _tax_trade(row) -> TaxTrade:
    classification = classify(
        AssetFacts(
            asset_type_id=row['asset_type_id'],
            ticker=row['ticker'],
            exchange_code=row['exchange_code'],
            broker_currency_id=row['broker_currency_id'],
            etf_segment_id=row['etf_segment_id'],
            fund_kind=row['fund_kind'],
        )
    )
    day = row['date']
    return TaxTrade(
        transaction_id=row['transaction_id'],
        portfolio_id=row['portfolio_id'],
        asset_id=row['asset_id'],
        ticker=row['ticker'] or f'#{row["asset_id"]}',
        kind=classification.kind,
        note=classification.note,
        broker_id=row['broker_id'],
        day=day.date() if hasattr(day, 'date') else day,
        quantity=_decimal(row['quantity']),
        price=_decimal(row['price']),
        price_usd=None if row['price_usd'] is None else _decimal(row['price_usd']),
        fees=None if row['fees'] is None else _decimal(row['fees']),
        withheld_income_tax=(
            None if row['withheld_income_tax'] is None else _decimal(row['withheld_income_tax'])
        ),
    )


def _asset_record(row) -> AssetRecord:
    return AssetRecord(
        asset_id=row['asset_id'],
        asset_type_id=row['asset_type_id'],
        ticker=row['ticker'],
        name=row['name'] or row['ticker'] or f'#{row["asset_id"]}',
        exchange_code=row['exchange_code'],
        issuer_cnpj=row['issuer_cnpj'],
        fund_cnpj=row['fund_cnpj'],
        etf_segment_id=row['etf_segment_id'],
        fund_kind=row['fund_kind'],
    )


def _broker_record(row) -> BrokerRecord:
    return BrokerRecord(
        broker_id=row['broker_id'],
        name=row['broker_name'],
        cnpj=row['broker_cnpj'],
        currency_id=row['broker_currency_id'],
    )
