"""A apuração do IR contra exemplos calculados à mão, não pelo motor.

Cada valor esperado está escrito como conta — 15% de 10.000,01 é 1.500,0015,
que arredonda para 1.500,00 — para que um teste que passe prove a regra, e não
apenas que o código continua dando o que dava.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY
from app.modules.portfolio.domain.income_tax.calendar import darf_due_date, easter
from app.modules.portfolio.domain.income_tax.darf import DarfPayment, DarfStatus
from app.modules.portfolio.domain.income_tax.pendency import PendencyCode
from app.modules.portfolio.domain.income_tax.report import IncomeTaxReport, assess
from app.modules.portfolio.domain.income_tax.rules import (
    RULES,
    CatalogueError,
    TaxRegime,
    TaxRule,
    rule_for,
    validate_catalogue,
)
from app.modules.portfolio.domain.income_tax.trades import (
    AssetFacts,
    ClassificationNote,
    CorporateEvent,
    TaxAssetKind,
    TaxTrade,
    classify,
)

pytestmark = pytest.mark.unit

D = Decimal
STOCK = TaxAssetKind.STOCK
ETF = TaxAssetKind.EQUITY_ETF
FII = TaxAssetKind.REAL_ESTATE_FUND
CRYPTO = TaxAssetKind.CRYPTO

_ASSET_IDS: dict[str, int] = {}


def _asset_id(ticker: str) -> int:
    return _ASSET_IDS.setdefault(ticker, len(_ASSET_IDS) + 1)


_next_id = iter(range(1, 100_000))


def trade(  # noqa: PLR0913
    day: str,
    ticker: str,
    quantity: str,
    price: str,
    *,
    kind: TaxAssetKind = STOCK,
    fees: str | None = '0',
    withheld: str | None = None,
    broker_id: int = 1,
    portfolio_id: int = 1,
    note: ClassificationNote | None = None,
) -> TaxTrade:
    return TaxTrade(
        transaction_id=next(_next_id),
        portfolio_id=portfolio_id,
        asset_id=_asset_id(ticker),
        ticker=ticker,
        kind=kind,
        note=note,
        broker_id=broker_id,
        day=date.fromisoformat(day),
        quantity=D(quantity),
        price=D(price),
        fees=None if fees is None else D(fees),
        withheld_income_tax=None if withheld is None else D(withheld),
    )


def run(
    year: int,
    trades: list[TaxTrade],
    *,
    events: list[CorporateEvent] = (),
    payments: list[DarfPayment] = (),
    today: date = date(2030, 1, 1),
) -> IncomeTaxReport:
    return assess(
        fiscal_year=year,
        trades=trades,
        events=events,
        payments=payments,
        today=today,
    )


def month(report: IncomeTaxReport, regime: TaxRegime, number: int):
    return report.months[regime][number - 1]


# --- Isenção das ações: o limite é de vendas, e é do contribuinte ------------


@pytest.mark.parametrize(
    ('price', 'sales', 'tax'),
    [
        # 100 × 199,9999 = 19.999,99: no limite, ganho de 9.999,99 isento.
        ('199.9999', '19999.99', '0.00'),
        # 20.000,00 ainda está no limite ("até R$ 20 mil").
        ('200', '20000.00', '0.00'),
        # 20.000,01 passa: ganho 10.000,01 × 15% = 1.500,0015 → 1.500,00.
        ('200.0001', '20000.01', '1500.00'),
    ],
)
def test_the_stock_exemption_is_on_monthly_sales_up_to_20k(price, sales, tax):
    report = run(
        2025,
        [trade('2025-03-03', 'PETR4', '100', '100'), trade('2025-03-20', 'PETR4', '-100', price)],
    )

    march = month(report, TaxRegime.COMMON, 3)
    assert march.exemption_sales == D(sales)
    assert march.tax_due == D(tax)


def test_the_limit_adds_sales_from_every_portfolio_and_broker():
    """10.000,00 numa carteira + 10.000,01 noutra: o mês passa do limite."""
    report = run(
        2025,
        [
            trade('2025-04-01', 'VALE3', '100', '50', portfolio_id=1, broker_id=1),
            trade('2025-04-10', 'VALE3', '-100', '100', portfolio_id=1, broker_id=1),
            trade('2025-04-01', 'ITUB4', '100', '50', portfolio_id=2, broker_id=2),
            trade('2025-04-10', 'ITUB4', '-100', '100.0001', portfolio_id=2, broker_id=2),
        ],
    )

    april = month(report, TaxRegime.COMMON, 4)
    assert april.within_exemption is False
    # Ganhos 5.000,00 + 5.000,01 = 10.000,01; × 15% = 1.500,0015 → 1.500,00.
    assert april.taxable_base == D('10000.01')
    assert april.tax_due == D('1500.00')


def test_an_exempt_gain_does_not_consume_the_loss_carried():
    report = run(
        2025,
        [
            # Jan: vende 9.000 com prejuízo de 1.000 — mês isento, perda guardada.
            trade('2025-01-10', 'AAAA3', '100', '100'),
            trade('2025-01-20', 'AAAA3', '-100', '90'),
            # Fev: vende 15.000 com ganho de 3.000 — isento, não usa o prejuízo.
            trade('2025-02-01', 'BBBB3', '100', '120'),
            trade('2025-02-10', 'BBBB3', '-100', '150'),
            # Mar: vende 30.000 com ganho de 2.000 — compensa 1.000, base 1.000.
            trade('2025-03-01', 'CCCC3', '100', '280'),
            trade('2025-03-10', 'CCCC3', '-100', '300'),
        ],
    )

    january, february, march = (month(report, TaxRegime.COMMON, n) for n in (1, 2, 3))
    assert january.loss_carried_out == D('1000')
    assert february.exempt_gain == D('3000')
    assert february.loss_carried_out == D('1000')
    assert march.loss_used == D('1000')
    assert march.taxable_base == D('1000')
    assert march.tax_due == D('150.00')
    assert march.loss_carried_out == 0


def test_an_etf_gain_is_taxed_even_when_the_stock_sales_are_exempt():
    report = run(
        2025,
        [
            trade('2025-05-02', 'WEGE3', '100', '80'),
            trade('2025-05-20', 'WEGE3', '-100', '100'),  # 10.000, ganho 2.000 isento
            trade('2025-05-02', 'BOVA11', '50', '80', kind=ETF),
            trade('2025-05-20', 'BOVA11', '-50', '100', kind=ETF),  # 5.000, ganho 1.000
        ],
    )

    may = month(report, TaxRegime.COMMON, 5)
    assert may.exemption_sales == D('10000')  # o ETF não entra na soma do limite
    assert may.exempt_gain == D('2000')
    assert may.tax_due == D('150.00')  # 1.000 × 15%


def test_an_etf_loss_offsets_a_stock_gain_in_the_same_month():
    report = run(
        2025,
        [
            trade('2025-06-02', 'PETR4', '100', '250'),
            trade('2025-06-20', 'PETR4', '-100', '300'),  # 30.000, ganho 5.000
            trade('2025-06-02', 'IVVB11', '100', '300', kind=ETF),
            trade('2025-06-20', 'IVVB11', '-100', '280', kind=ETF),  # perda 2.000
        ],
    )

    june = month(report, TaxRegime.COMMON, 6)
    assert june.taxable_base == D('3000')
    assert june.tax_due == D('450.00')


def test_real_estate_funds_keep_their_own_loss_and_rate():
    report = run(
        2025,
        [
            # Jan: FII perde 1.000.
            trade('2025-01-02', 'MXRF11', '1000', '10', kind=FII),
            trade('2025-01-20', 'MXRF11', '-1000', '9', kind=FII),
            # Fev: ações vendem 30.000 com ganho 4.000 — a perda do FII não abate.
            trade('2025-02-02', 'PETR4', '100', '260'),
            trade('2025-02-20', 'PETR4', '-100', '300'),
            # Mar: FII ganha 1.500 — compensa 1.000, base 500 × 20%.
            trade('2025-03-02', 'HGLG11', '100', '150', kind=FII),
            trade('2025-03-20', 'HGLG11', '-100', '165', kind=FII),
        ],
    )

    assert month(report, TaxRegime.COMMON, 2).tax_due == D('600.00')
    march = month(report, TaxRegime.REAL_ESTATE_FUND, 3)
    assert march.loss_used == D('1000')
    assert march.tax_due == D('100.00')


def test_the_loss_crosses_the_year_and_empty_months():
    trades = [
        trade('2024-11-04', 'DDDD3', '100', '280'),
        trade('2024-12-16', 'DDDD3', '-100', '250'),  # 25.000, perda 3.000
        trade('2025-03-03', 'EEEE3', '100', '250'),
        trade('2025-03-17', 'EEEE3', '-100', '300'),  # 30.000, ganho 5.000
    ]
    report = run(2025, trades)

    assert month(report, TaxRegime.COMMON, 1).loss_carried_in == D('3000')
    assert month(report, TaxRegime.COMMON, 2).loss_carried_out == D('3000')
    assert month(report, TaxRegime.COMMON, 3).tax_due == D('300.00')  # (5.000 − 3.000) × 15%
    assert run(2024, trades).losses_to_carry[TaxRegime.COMMON] == D('3000')


def test_a_later_loss_does_not_change_an_earlier_month():
    gain_in_march = [
        trade('2025-03-03', 'PETR4', '100', '250'),
        trade('2025-03-17', 'PETR4', '-100', '300'),
    ]
    loss_in_april = [
        trade('2025-04-01', 'VALE3', '100', '300'),
        trade('2025-04-20', 'VALE3', '-100', '200'),
    ]

    before = month(run(2025, gain_in_march), TaxRegime.COMMON, 3)
    after = month(run(2025, gain_in_march + loss_in_april), TaxRegime.COMMON, 3)

    assert after.tax_due == before.tax_due == D('750.00')


def test_fees_enter_the_cost_and_leave_the_sale():
    report = run(
        2025,
        [
            trade('2025-07-01', 'PETR4', '100', '100', fees='10'),
            trade('2025-07-20', 'PETR4', '-100', '300', fees='15'),
        ],
    )

    (sale,) = report.sales
    assert sale.cost == D('10010')
    assert sale.result == D('19975')  # 30.000 − 15 − 10.010
    assert month(report, TaxRegime.COMMON, 7).tax_due == D('2996.25')


def test_the_average_cost_joins_every_broker():
    """Compra a 10 numa corretora e a 20 noutra: custo médio 15 para qualquer venda."""
    report = run(
        2025,
        [
            trade('2025-01-02', 'PETR4', '100', '10', broker_id=1),
            trade('2025-01-03', 'PETR4', '100', '20', broker_id=2),
            trade('2025-01-10', 'PETR4', '-100', '30', broker_id=1),
        ],
    )

    (sale,) = report.sales
    assert sale.cost == D('1500')
    assert sale.result == D('1500')


# --- IRRF -----------------------------------------------------------------


def test_withheld_tax_is_deducted_and_the_rest_waits_for_a_later_month():
    report = run(
        2025,
        [
            # Fev: vende 25.000 sem ganho, IRRF 1,25 — nada a abater, fica.
            trade('2025-02-03', 'PETR4', '250', '100'),
            trade('2025-02-20', 'PETR4', '-250', '100', withheld='1.25'),
            # Mar: vende 30.300 com ganho 300 → imposto 45,00, IRRF 1,52 no mês.
            trade('2025-03-03', 'VALE3', '300', '100'),
            trade('2025-03-20', 'VALE3', '-300', '101', withheld='1.52'),
        ],
    )

    february, march = month(report, TaxRegime.COMMON, 2), month(report, TaxRegime.COMMON, 3)
    assert february.withheld_carried_out == D('1.25')
    assert march.tax_due == D('45.00')
    assert march.withheld_used == D('2.77')
    assert march.tax_payable == D('42.23')


def test_withheld_tax_left_in_december_goes_to_the_declaration_not_to_january():
    trades = [
        trade('2025-12-01', 'PETR4', '250', '100'),
        trade('2025-12-15', 'PETR4', '-250', '100', withheld='1.25'),
    ]

    assert run(2025, trades).withheld_to_declare[TaxRegime.COMMON] == D('1.25')
    assert month(run(2026, trades), TaxRegime.COMMON, 1).withheld_carried_in == 0


# --- DARF -----------------------------------------------------------------


def test_a_darf_below_10_waits_and_joins_the_next_one():
    report = run(
        2025,
        [
            # Jan: FII ganha 49,95 × 20% = 9,99 — abaixo do mínimo.
            trade('2025-01-02', 'MXRF11', '10', '100', kind=FII),
            trade('2025-01-20', 'MXRF11', '-10', '104.995', kind=FII),
            # Fev: FII ganha 0,05 × 20% = 0,01 — com os 9,99, chega a 10,00.
            trade('2025-02-03', 'MXRF11', '10', '100', kind=FII),
            trade('2025-02-20', 'MXRF11', '-10', '100.005', kind=FII),
        ],
    )

    january, february = report.obligations
    assert january.amount == D('9.99')
    assert january.status == DarfStatus.BELOW_MINIMUM
    assert january.carried_out == D('9.99')
    assert february.carried_in == D('9.99')
    assert february.amount == D('10.00')
    assert february.status == DarfStatus.OVERDUE  # venceu em 31/03/2025


def test_common_operations_and_real_estate_funds_share_the_6015_darf():
    report = run(
        2025,
        [
            # Ações: 30.033,33 de venda, ganho 33,33 × 15% = 4,9995 → 5,00.
            trade('2025-01-02', 'PETR4', '300', '100'),
            trade('2025-01-20', 'PETR4', '-300', '100.1111'),
            # FII: ganho 25,00 × 20% = 5,00.
            trade('2025-01-02', 'MXRF11', '10', '100', kind=FII),
            trade('2025-01-20', 'MXRF11', '-10', '102.5', kind=FII),
        ],
    )

    (darf,) = report.obligations
    assert darf.revenue_code == '6015'
    assert darf.amount == D('10.00')
    assert darf.status != DarfStatus.BELOW_MINIMUM
    assert dict(darf.by_regime) == {
        TaxRegime.COMMON: D('5.00'),
        TaxRegime.REAL_ESTATE_FUND: D('5.00'),
    }


def _one_obligation_of_150(payments, today):
    trades = [
        trade('2025-03-03', 'CCCC3', '100', '280'),
        trade('2025-03-10', 'CCCC3', '-100', '290'),  # 29.000, ganho 1.000 → 150,00
    ]
    (darf,) = run(2025, trades, payments=payments, today=today).obligations
    return darf


def _payment(principal: str, period=date(2025, 3, 1), code='6015') -> DarfPayment:
    return DarfPayment(
        user_id=1,
        revenue_code=code,
        period=period,
        paid_on=date(2025, 4, 20),
        principal=D(principal),
    )


def test_a_darf_is_paid_only_when_a_payment_is_registered():
    before_due = date(2025, 4, 1)
    after_due = date(2025, 5, 2)

    assert _one_obligation_of_150([], before_due).status == DarfStatus.OPEN
    assert _one_obligation_of_150([], after_due).status == DarfStatus.OVERDUE
    assert _one_obligation_of_150([_payment('150.00')], after_due).status == DarfStatus.PAID
    partial = _one_obligation_of_150([_payment('100.00')], after_due)
    assert partial.status == DarfStatus.PARTIALLY_PAID
    assert partial.balance == D('50.00')


def test_a_payment_for_a_month_without_tax_is_a_pendency():
    report = run(
        2025,
        [trade('2025-03-03', 'PETR4', '1', '10')],
        payments=[_payment('50.00', period=date(2025, 6, 1))],
    )

    assert [p.code for p in report.pendencies] == [PendencyCode.PAYMENT_WITHOUT_OBLIGATION]


@pytest.mark.parametrize(
    ('period', 'due'),
    [
        # 31/03/2024 é domingo, 30 é sábado e 29 é Sexta-feira Santa.
        (date(2024, 2, 1), date(2024, 3, 28)),
        # 31/12 não tem expediente bancário ao público.
        (date(2024, 11, 1), date(2024, 12, 30)),
        (date(2025, 1, 1), date(2025, 2, 28)),
        (date(2024, 12, 1), date(2025, 1, 31)),
    ],
)
def test_the_darf_is_due_on_the_last_bank_day_of_the_next_month(period, due):
    assert darf_due_date(period) == due


def test_easter_matches_the_calendar():
    assert [easter(year) for year in (2024, 2025, 2026)] == [
        date(2024, 3, 31),
        date(2025, 4, 20),
        date(2026, 4, 5),
    ]


# --- Eventos --------------------------------------------------------------


def test_a_split_changes_the_quantity_and_keeps_the_cost():
    report = run(
        2025,
        [
            trade('2025-01-02', 'PETR4', '100', '20'),
            trade('2025-04-01', 'PETR4', '-200', '15'),
        ],
        events=[
            CorporateEvent(
                asset_id=_asset_id('PETR4'), day=date(2025, 3, 1), type='SPLIT', factor=D('2')
            )
        ],
    )

    (sale,) = report.sales
    assert sale.cost == D('2000')
    assert sale.result == D('1000')
    assert report.pendencies == ()


def test_a_reverse_split_before_the_sale():
    report = run(
        2025,
        [
            trade('2025-01-02', 'MGLU3', '1000', '1'),
            trade('2025-04-01', 'MGLU3', '-100', '12'),
        ],
        events=[
            CorporateEvent(
                asset_id=_asset_id('MGLU3'),
                day=date(2025, 3, 1),
                type='REVERSE_SPLIT',
                factor=D('0.1'),
            )
        ],
    )

    (sale,) = report.sales
    assert sale.result == D('200')  # 1.200 − 1.000
    assert report.pendencies == ()


def test_an_event_after_the_sale_does_not_touch_it():
    report = run(
        2025,
        [
            trade('2025-01-02', 'PETR4', '100', '10'),
            trade('2025-01-20', 'PETR4', '-50', '12'),
        ],
        events=[
            CorporateEvent(
                asset_id=_asset_id('PETR4'), day=date(2025, 3, 1), type='SPLIT', factor=D('2')
            )
        ],
    )

    (sale,) = report.sales
    assert sale.result == D('100')  # 600 − 500


def test_a_bonus_enters_without_cost_and_says_so():
    report = run(
        2025,
        [
            trade('2025-01-02', 'ITSA4', '100', '10'),
            trade('2025-04-01', 'ITSA4', '-110', '10'),
        ],
        events=[
            CorporateEvent(
                asset_id=_asset_id('ITSA4'), day=date(2025, 3, 1), type='BONUS', factor=D('1.1')
            )
        ],
    )

    (sale,) = report.sales
    assert sale.cost == D('1000')
    assert [p.code for p in report.pendencies] == [PendencyCode.BONUS_WITHOUT_COST]


def test_selling_more_than_the_history_holds_is_a_pendency():
    report = run(2025, [trade('2025-05-02', 'PETR4', '-10', '10')])

    (sale,) = report.sales
    assert sale.cost == 0
    assert [p.code for p in report.pendencies] == [PendencyCode.SALE_WITHOUT_POSITION]


# --- O que fica fora do DARF, e o que a apuração avisa ------------------------


def test_a_fixed_income_etf_is_taxed_at_source_and_stays_out_of_the_darf():
    report = run(
        2025,
        [
            trade('2025-02-03', 'IMAB11', '1000', '100', kind=TaxAssetKind.FIXED_INCOME_ETF),
            trade('2025-02-20', 'IMAB11', '-1000', '110', kind=TaxAssetKind.FIXED_INCOME_ETF),
        ],
    )

    assert report.sales[0].result == D('10000')
    assert month(report, TaxRegime.COMMON, 2).sales == 0
    assert report.obligations == ()


def test_buying_and_selling_on_the_same_day_and_broker_is_flagged_as_day_trade():
    same_broker = run(
        2025,
        [
            trade('2025-02-03', 'PETR4', '100', '30'),
            trade('2025-02-03', 'PETR4', '-100', '31'),
        ],
    )
    other_broker = run(
        2025,
        [
            trade('2025-02-03', 'PETR4', '100', '30', broker_id=1),
            trade('2025-02-03', 'PETR4', '-100', '31', broker_id=2),
        ],
    )

    assert [p.code for p in same_broker.pendencies] == [PendencyCode.DAY_TRADE]
    assert other_broker.pendencies == ()


def test_sales_without_fees_are_counted_once():
    report = run(
        2025,
        [
            trade('2025-02-03', 'PETR4', '100', '30', fees=None),
            trade('2025-02-10', 'PETR4', '-50', '31'),
            trade('2025-02-11', 'PETR4', '-50', '31'),
            trade('2025-02-03', 'VALE3', '100', '30'),
            trade('2025-02-10', 'VALE3', '-100', '31'),
        ],
    )

    (pendency,) = report.pendencies
    assert pendency.code == PendencyCode.MISSING_FEES
    assert pendency.message.startswith('2 vendas')


def test_a_foreign_sale_is_reported_and_left_out():
    report = run(
        2025,
        [
            trade(
                '2025-02-03',
                'AAPL',
                '10',
                '1000',
                kind=TaxAssetKind.OUT_OF_SCOPE,
                note=ClassificationNote.FOREIGN,
            ),
            trade(
                '2025-03-03',
                'AAPL',
                '-10',
                '1100',
                kind=TaxAssetKind.OUT_OF_SCOPE,
                note=ClassificationNote.FOREIGN,
            ),
        ],
    )

    assert report.sales == ()
    assert [p.code for p in report.pendencies] == [PendencyCode.FOREIGN_SALE]


def test_a_year_without_sales_still_has_twelve_months():
    report = run(2025, [])

    for regime in TaxRegime:
        assert len(report.months[regime]) == 12
        assert all(m.tax_due == 0 for m in report.months[regime])


# --- Cripto: ganho de capital ---------------------------------------------


def test_crypto_sales_up_to_35k_in_the_month_are_exempt():
    report = run(
        2025,
        [
            trade('2025-02-03', 'BTC', '1', '30000', kind=CRYPTO),
            trade('2025-02-20', 'BTC', '-1', '35000', kind=CRYPTO),
        ],
    )

    february = month(report, TaxRegime.CRYPTO, 2)
    assert february.exempt_gain == D('5000')
    assert february.tax_due == 0


def test_a_crypto_loss_offsets_nothing_neither_now_nor_later():
    report = run(
        2025,
        [
            trade('2025-02-03', 'BTC', '1', '30000', kind=CRYPTO),
            trade('2025-02-03', 'ETH', '10', '2000', kind=CRYPTO),
            trade('2025-02-20', 'BTC', '-1', '35000.01', kind=CRYPTO),  # ganho 5.000,01
            trade('2025-02-20', 'ETH', '-10', '1900', kind=CRYPTO),  # perda 1.000
            trade('2025-03-03', 'BTC', '1', '40000', kind=CRYPTO),
            trade('2025-03-20', 'BTC', '-1', '41000', kind=CRYPTO),  # ganho 1.000
        ],
    )

    february, march = month(report, TaxRegime.CRYPTO, 2), month(report, TaxRegime.CRYPTO, 3)
    # 35.000,01 + 19.000 de vendas passa do limite; só o ganho do BTC é base.
    assert february.taxable_base == D('5000.01')
    assert february.tax_due == D('750.00')  # 750,0015
    assert march.loss_carried_in == 0
    assert march.tax_due == D('150.00')
    assert {o.revenue_code for o in report.obligations} == {'4600'}


def test_crypto_gains_above_5_million_pay_the_next_bracket():
    crypto = rule_for(TaxRegime.CRYPTO, date(2025, 1, 1))

    # 5.000.000 × 15% + 1.000.000 × 17,5%
    assert crypto.tax_on(D('6000000')) == D('925000')


# --- Classificação --------------------------------------------------------


@pytest.mark.parametrize(
    ('facts', 'kind', 'note'),
    [
        (
            {'asset_type_id': ASSET_TYPE.ETF, 'ticker': 'IMAB11', 'etf_segment_id': 3},
            TaxAssetKind.FIXED_INCOME_ETF,
            None,
        ),
        ({'asset_type_id': ASSET_TYPE.ETF, 'ticker': 'BOVA11', 'etf_segment_id': 1}, ETF, None),
        (
            {'asset_type_id': ASSET_TYPE.ETF, 'ticker': 'BOVA11'},
            ETF,
            ClassificationNote.ETF_WITHOUT_SEGMENT,
        ),
        (
            {'asset_type_id': ASSET_TYPE.ETF, 'ticker': 'VOO', 'exchange_code': 'NYSE'},
            TaxAssetKind.OUT_OF_SCOPE,
            ClassificationNote.FOREIGN,
        ),
        (
            {'asset_type_id': ASSET_TYPE.STOCK, 'ticker': 'AAPL'},
            TaxAssetKind.OUT_OF_SCOPE,
            ClassificationNote.FOREIGN,
        ),
        ({'asset_type_id': ASSET_TYPE.STOCK, 'ticker': 'PETR4'}, STOCK, None),
        ({'asset_type_id': ASSET_TYPE.FI, 'ticker': 'RZAG11', 'fund_kind': 'FIAGRO'}, FII, None),
        (
            {'asset_type_id': ASSET_TYPE.FI, 'ticker': 'JURO11', 'fund_kind': 'FI'},
            TaxAssetKind.OUT_OF_SCOPE,
            ClassificationNote.LISTED_FUND,
        ),
        (
            {'asset_type_id': ASSET_TYPE.FI, 'ticker': None, 'fund_kind': 'FIDC'},
            TaxAssetKind.OUT_OF_SCOPE,
            None,
        ),
        (
            {
                'asset_type_id': ASSET_TYPE.CRIPTO,
                'ticker': 'BTC',
                'broker_currency_id': CURRENCY.BRL,
            },
            CRYPTO,
            None,
        ),
        (
            {
                'asset_type_id': ASSET_TYPE.CRIPTO,
                'ticker': 'BTC',
                'broker_currency_id': CURRENCY.USD,
            },
            TaxAssetKind.OUT_OF_SCOPE,
            ClassificationNote.FOREIGN_CRYPTO,
        ),
        (
            {'asset_type_id': ASSET_TYPE.CDB, 'ticker': 'CDB C6 12/02/2027'},
            TaxAssetKind.OUT_OF_SCOPE,
            None,
        ),
    ],
)
def test_classification(facts, kind, note):
    facts = {'exchange_code': None, 'broker_currency_id': CURRENCY.BRL, **facts}

    classification = classify(AssetFacts(**facts))

    assert (classification.kind, classification.note) == (kind, note)


# --- O catálogo -----------------------------------------------------------


def test_the_catalogue_is_valid():
    validate_catalogue(RULES)


def _common(valid_from: date, valid_until: date | None) -> TaxRule:
    current = rule_for(TaxRegime.COMMON, date(2025, 1, 1))
    return TaxRule(**{**current.__dict__, 'valid_from': valid_from, 'valid_until': valid_until})


def test_two_versions_valid_on_the_same_day_are_refused():
    with pytest.raises(CatalogueError):
        validate_catalogue([_common(date(2005, 1, 1), None), _common(date(2027, 1, 1), None)])


def test_a_version_changing_in_the_middle_of_a_month_is_refused():
    with pytest.raises(CatalogueError):
        validate_catalogue([_common(date(2005, 1, 1), date(2027, 1, 15))])


def test_a_hypothetical_rate_change_applies_only_from_its_date():
    """Exemplo hipotético do plano: o ETF passa de 15% a 20% em D. Não é lei."""
    from app.modules.portfolio.domain.income_tax.rules import RateBracket

    d = date(2025, 6, 1)
    old = _common(date(2005, 1, 1), d)
    new = TaxRule(**{
        **old.__dict__,
        'valid_from': d,
        'valid_until': None,
        'brackets': (RateBracket(up_to=None, rate=D('0.20')),),
    })
    rules = [old, new, *(rule for rule in RULES if rule.regime != TaxRegime.COMMON)]
    trades = [
        trade('2025-05-02', 'BOVA11', '100', '100', kind=ETF),
        trade('2025-05-20', 'BOVA11', '-100', '110', kind=ETF),  # ganho 1.000 antes de D
        trade('2025-06-02', 'BOVA11', '100', '100', kind=ETF),
        trade('2025-06-20', 'BOVA11', '-100', '110', kind=ETF),  # ganho 1.000 depois de D
    ]

    report = assess(
        fiscal_year=2025,
        trades=trades,
        events=(),
        payments=(),
        today=date(2030, 1, 1),
        rules=rules,
    )

    assert month(report, TaxRegime.COMMON, 5).tax_due == D('150.00')
    assert month(report, TaxRegime.COMMON, 6).tax_due == D('200.00')


def test_a_sale_before_the_catalogue_is_not_assessed_and_says_so():
    report = run(
        2016,
        [
            trade('2016-03-02', 'BTC', '1', '1000', kind=CRYPTO),
            trade('2016-03-20', 'BTC', '-1', '50000', kind=CRYPTO),
        ],
    )

    assert month(report, TaxRegime.CRYPTO, 3).tax_due == 0
    assert [p.code for p in report.pendencies] == [PendencyCode.NO_RULE]
