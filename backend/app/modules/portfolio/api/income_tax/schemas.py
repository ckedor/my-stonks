"""Contratos da apuração do IR.

Dinheiro sai como texto com duas casas ("1500.00"), não como número: o valor é
`Decimal` do motor até aqui, e passar por float na última etapa devolveria o
ruído binário que o motor inteiro evita. A tela converte só para escrever.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import BaseModel, Field, PlainSerializer

from app.modules.portfolio.domain.income_tax.assessment import REGIME_OF_KIND, MonthlyAssessment
from app.modules.portfolio.domain.income_tax.darf import DarfObligation, DarfStatus
from app.modules.portfolio.domain.income_tax.foreign import ForeignItem, ForeignYear
from app.modules.portfolio.domain.income_tax.ledger import RealizedSale
from app.modules.portfolio.domain.income_tax.pendency import PendencyCode
from app.modules.portfolio.domain.income_tax.report import IncomeTaxReport
from app.modules.portfolio.domain.income_tax.rules import DARF_MINIMUM, TaxRegime
from app.modules.portfolio.domain.income_tax.trades import TaxAssetKind

_CENT = Decimal('0.01')

Money = Annotated[
    Decimal,
    PlainSerializer(
        lambda value: str(value.quantize(_CENT, rounding=ROUND_HALF_UP)),
        return_type=str,
        when_used='json',
    ),
]
#: Quantidades e alíquotas: o valor exato, sem expoente.
Exact = Annotated[
    Decimal,
    PlainSerializer(
        lambda value: format(value.normalize(), 'f'), return_type=str, when_used='json'
    ),
]


class MonthlyAssessmentResponse(BaseModel):
    month: date
    #: Se há regra para o mês. Sem regra, o mês não foi apurado.
    covered: bool
    sales: Money
    exemption_sales: Money
    within_exemption: bool
    result: Money
    exempt_gain: Money
    loss_carried_in: Money
    loss_used: Money
    loss_carried_out: Money
    taxable_base: Money
    tax_due: Money
    withheld_in_month: Money
    withheld_carried_in: Money
    withheld_used: Money
    withheld_carried_out: Money
    tax_payable: Money
    #: O que se registrou pago do DARF deste mês, na parte deste regime.
    tax_paid: Money
    #: Resultado sem o ganho isento: o "resultado líquido do mês" da ficha.
    net_result: Money

    @classmethod
    def from_domain(
        cls, month: MonthlyAssessment, tax_paid: Decimal
    ) -> 'MonthlyAssessmentResponse':
        return cls(
            covered=month.rule is not None,
            tax_paid=tax_paid,
            **{
                name: getattr(month, name)
                for name in cls.model_fields
                if name not in {'covered', 'tax_paid'}
            },
        )


class RegimeResponse(BaseModel):
    regime: TaxRegime
    #: A alíquota, quando é uma só; nula nas faixas progressivas.
    rate: Exact | None
    revenue_code: str | None
    monthly_sales_exemption: Money | None
    carries_losses: bool | None
    source: str | None
    months: list[MonthlyAssessmentResponse]
    #: Prejuízo a compensar no fim do ano: vai para a declaração.
    loss_to_carry: Money
    #: IRRF que sobrou no ano: compensa-se na declaração de ajuste.
    withheld_to_declare: Money


class RealizedSaleResponse(BaseModel):
    transaction_id: int
    portfolio_id: int
    asset_id: int
    ticker: str
    kind: TaxAssetKind
    #: Nulo para o que fica fora do DARF (ETF de renda fixa).
    regime: TaxRegime | None
    broker_id: int
    day: date
    quantity: Exact
    gross_value: Money
    fees: Money
    cost: Money
    result: Money
    withheld_income_tax: Money
    fees_informed: bool

    @classmethod
    def from_domain(cls, sale: RealizedSale) -> 'RealizedSaleResponse':
        return cls(
            regime=REGIME_OF_KIND.get(sale.kind),
            **{name: getattr(sale, name) for name in cls.model_fields if name != 'regime'},
        )


class DarfPaymentResponse(BaseModel):
    id: int
    revenue_code: str
    period: date
    paid_on: date
    principal: Money
    fine: Money
    interest: Money

    model_config = {'from_attributes': True}


class DarfRegimeAmount(BaseModel):
    regime: TaxRegime
    amount: Money


class DarfObligationResponse(BaseModel):
    revenue_code: str
    period: date
    due_date: date
    by_regime: list[DarfRegimeAmount]
    carried_in: Money
    amount: Money
    carried_out: Money
    paid_principal: Money
    balance: Money
    status: DarfStatus
    payments: list[DarfPaymentResponse]

    @classmethod
    def from_domain(cls, obligation: DarfObligation) -> 'DarfObligationResponse':
        return cls(
            revenue_code=obligation.revenue_code,
            period=obligation.period,
            due_date=obligation.due_date,
            by_regime=[
                DarfRegimeAmount(regime=regime, amount=amount)
                for regime, amount in obligation.by_regime
            ],
            carried_in=obligation.carried_in,
            amount=obligation.amount,
            carried_out=obligation.carried_out,
            paid_principal=obligation.paid_principal,
            balance=obligation.balance,
            status=obligation.status,
            payments=[DarfPaymentResponse.model_validate(p) for p in obligation.payments],
        )


class PendencyResponse(BaseModel):
    code: PendencyCode
    message: str
    day: date | None
    asset_id: int | None
    ticker: str | None
    transaction_ids: list[int]


class AssetsAndRightsItemResponse(BaseModel):
    """Um bem da ficha Bens e Direitos, com os campos na ordem do programa."""

    asset_id: int
    broker_id: int
    group: str
    group_name: str
    code: str
    code_name: str
    country_code: str
    country_name: str
    cnpj: str | None
    cnpj_label: str | None
    ticker: str | None
    traded_on_exchange: bool | None
    discrimination: str
    previous_value: Money
    current_value: Money
    note: str | None
    #: Quadro "Aplicação Financeira (R$)": só nos bens no exterior desde 2024.
    foreign_income: Money | None
    foreign_tax_paid: Money | None

    model_config = {'from_attributes': True}


class ForeignItemResponse(BaseModel):
    """O rendimento de um bem no exterior no ano, com de onde ele vem."""

    asset_id: int
    broker_id: int
    ticker: str
    sales_value: Money
    sales_result: Money
    dividends_received: Money
    dividends_gross: Money
    tax_withheld_abroad: Money
    #: O campo "Imposto pago no exterior" do quadro.
    tax_paid_abroad: Money
    #: O campo "Rendimento ou Perda" do quadro.
    income: Money

    @classmethod
    def from_domain(cls, item: ForeignItem) -> 'ForeignItemResponse':
        return cls(**{name: getattr(item, name) for name in cls.model_fields})


class ForeignYearResponse(BaseModel):
    """A apuração anual do exterior: a conta que o programa refaz, para conferir."""

    #: Se o ano tem a regra anual da Lei 14.754 (de 2024 em diante).
    covered: bool
    rate: Exact | None
    us_dividend_withholding: Exact | None
    source: str | None
    items: list[ForeignItemResponse]
    gains: Money
    losses: Money
    loss_carried_in: Money
    loss_used: Money
    loss_carried_out: Money
    taxable_base: Money
    tax_due: Money
    tax_credit: Money
    tax_payable: Money

    @classmethod
    def from_domain(cls, year: ForeignYear) -> 'ForeignYearResponse':
        rule = year.rule
        return cls(
            covered=rule is not None,
            rate=rule.rate if rule else None,
            us_dividend_withholding=rule.us_dividend_withholding if rule else None,
            source=rule.source if rule else None,
            items=[ForeignItemResponse.from_domain(item) for item in year.items],
            **{
                name: getattr(year, name)
                for name in (
                    'gains',
                    'losses',
                    'loss_carried_in',
                    'loss_used',
                    'loss_carried_out',
                    'taxable_base',
                    'tax_due',
                    'tax_credit',
                    'tax_payable',
                )
            },
        )


class IncomeLineResponse(BaseModel):
    """Uma linha de Rendimentos Isentos ou de Tributação Exclusiva."""

    code: str
    code_name: str
    payer_cnpj: str | None
    payer_name: str | None
    amount: Money
    note: str | None

    model_config = {'from_attributes': True}


class CapitalGainOperationResponse(BaseModel):
    """Uma alienação de criptoativo para o GCAP."""

    transaction_id: int
    day: date
    ticker: str
    quantity: Exact
    sale_value: Money
    acquisition_cost: Money
    fees: Money
    capital_gain: Money

    model_config = {'from_attributes': True}


class IncomeTaxAssessmentResponse(BaseModel):
    fiscal_year: int
    #: O exercício em que o ano-calendário é declarado.
    filing_year: int
    darf_minimum: Money
    regimes: list[RegimeResponse]
    sales: list[RealizedSaleResponse]
    obligations: list[DarfObligationResponse]
    pendencies: list[PendencyResponse]
    assets_and_rights: list[AssetsAndRightsItemResponse]
    exempt_income: list[IncomeLineResponse]
    exclusive_income: list[IncomeLineResponse]
    capital_gains: list[CapitalGainOperationResponse]
    foreign: ForeignYearResponse | None

    @classmethod
    def from_report(cls, report: IncomeTaxReport) -> 'IncomeTaxAssessmentResponse':
        regimes = []
        for regime in TaxRegime:
            months = report.months.get(regime, ())
            rule = next((month.rule for month in reversed(months) if month.rule), None)
            regimes.append(
                RegimeResponse(
                    regime=regime,
                    rate=rule.flat_rate if rule else None,
                    revenue_code=rule.revenue_code if rule else None,
                    monthly_sales_exemption=rule.monthly_sales_exemption if rule else None,
                    carries_losses=rule.carries_losses if rule else None,
                    source=rule.source if rule else None,
                    months=[
                        MonthlyAssessmentResponse.from_domain(
                            month, report.tax_paid.get((regime, month.month), Decimal(0))
                        )
                        for month in months
                    ],
                    loss_to_carry=report.losses_to_carry.get(regime, Decimal(0)),
                    withheld_to_declare=report.withheld_to_declare.get(regime, Decimal(0)),
                )
            )
        return cls(
            fiscal_year=report.fiscal_year,
            filing_year=report.fiscal_year + 1,
            darf_minimum=DARF_MINIMUM,
            regimes=regimes,
            sales=[RealizedSaleResponse.from_domain(sale) for sale in report.sales],
            obligations=[
                DarfObligationResponse.from_domain(obligation) for obligation in report.obligations
            ],
            pendencies=[
                PendencyResponse(
                    code=pendency.code,
                    message=pendency.message,
                    day=pendency.day,
                    asset_id=pendency.asset_id,
                    ticker=pendency.ticker,
                    transaction_ids=list(pendency.transaction_ids),
                )
                for pendency in report.pendencies
            ],
            assets_and_rights=[
                AssetsAndRightsItemResponse.model_validate(item)
                for item in report.assets_and_rights
            ],
            exempt_income=[
                IncomeLineResponse.model_validate(line) for line in report.exempt_income
            ],
            exclusive_income=[
                IncomeLineResponse.model_validate(line) for line in report.exclusive_income
            ],
            capital_gains=[
                CapitalGainOperationResponse.model_validate(operation)
                for operation in report.capital_gains
            ],
            foreign=ForeignYearResponse.from_domain(report.foreign) if report.foreign else None,
        )


class DarfPaymentRequest(BaseModel):
    revenue_code: str = Field(pattern=r'^\d{4}$')
    #: Qualquer dia do mês de apuração; é guardado no primeiro.
    period: date
    paid_on: date
    principal: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    fine: Decimal = Field(default=Decimal(0), ge=0, max_digits=14, decimal_places=2)
    interest: Decimal = Field(default=Decimal(0), ge=0, max_digits=14, decimal_places=2)
