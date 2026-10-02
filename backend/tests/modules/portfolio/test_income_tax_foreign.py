"""Aplicações financeiras no exterior: a apuração anual da Lei 14.754/2023."""

from datetime import date
from decimal import Decimal

import pytest

from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY
from app.modules.portfolio.domain.income_tax.declaration import (
    AssetRecord,
    BrokerRecord,
    DividendRecord,
)
from app.modules.portfolio.domain.income_tax.pendency import PendencyCode
from app.modules.portfolio.domain.income_tax.report import assess
from app.modules.portfolio.domain.income_tax.rules import (
    FOREIGN_RULES,
    CatalogueError,
    ForeignRule,
    validate_foreign_catalogue,
)
from app.modules.portfolio.domain.income_tax.trades import (
    ClassificationNote,
    TaxAssetKind,
    TaxTrade,
)

pytestmark = pytest.mark.unit

D = Decimal
AVENUE = 2
OTHER = 3
BROKERS = {
    AVENUE: BrokerRecord(broker_id=AVENUE, name='Avenue', cnpj=None, currency_id=CURRENCY.USD),
    OTHER: BrokerRecord(broker_id=OTHER, name='Outra', cnpj=None, currency_id=CURRENCY.USD),
}
ASSETS = {
    asset_id: AssetRecord(
        asset_id=asset_id,
        asset_type_id=type_id,
        ticker=ticker,
        name=ticker,
        exchange_code='NYSE',
    )
    for asset_id, ticker, type_id in (
        (1, 'IVV', ASSET_TYPE.ETF),
        (2, 'NU', ASSET_TYPE.STOCK),
        (3, 'SCHD', ASSET_TYPE.ETF),
    )
}
TICKER_ID = {record.ticker: asset_id for asset_id, record in ASSETS.items()}

_ids = iter(range(1, 100_000))


def trade(day, ticker, quantity, price, *, price_usd=None, broker_id=AVENUE) -> TaxTrade:  # noqa: PLR0913
    return TaxTrade(
        transaction_id=next(_ids),
        portfolio_id=1,
        asset_id=TICKER_ID[ticker],
        ticker=ticker,
        kind=TaxAssetKind.OUT_OF_SCOPE,
        note=ClassificationNote.FOREIGN,
        broker_id=broker_id,
        day=date.fromisoformat(day),
        quantity=D(quantity),
        price=D(price),
        price_usd=None if price_usd is None else D(price_usd),
        fees=None,
    )


def dividend(day, ticker, amount) -> DividendRecord:
    return DividendRecord(asset_id=TICKER_ID[ticker], day=date.fromisoformat(day), amount=D(amount))


def report(year, trades, dividends=()):
    return assess(
        fiscal_year=year,
        trades=trades,
        events=(),
        payments=(),
        today=date(2030, 1, 1),
        assets=ASSETS,
        brokers=BROKERS,
        dividends=dividends,
    )


def item(result, ticker, broker_id=AVENUE):
    (found,) = [
        i
        for i in result.foreign.items
        if i.asset_id == TICKER_ID[ticker] and i.broker_id == broker_id
    ]
    return found


def test_a_foreign_sale_is_assessed_in_reais_without_a_pendency():
    result = report(
        2026,
        [
            trade('2024-05-28', 'NU', '25', '61.22'),
            trade('2026-06-08', 'NU', '-25', '60.00'),
        ],
    )

    nu = item(result, 'NU')
    assert (nu.sales_value, nu.sales_result) == (D('1500.00'), D('-30.50'))
    assert nu.income == D('-30.50')
    assert result.sales == ()  # nada disso vai ao DARF
    assert [p.code for p in result.pendencies] == []


def test_a_foreign_sale_before_the_law_is_still_a_pendency():
    """Antes de 2024 era ganho de capital (GCAP): a pendência tem de continuar a disparar."""
    result = report(
        2023,
        [
            trade('2023-02-03', 'NU', '10', '50'),
            trade('2023-03-03', 'NU', '-10', '60'),
        ],
    )

    assert result.foreign.rule is None
    assert result.foreign.items == ()
    assert [p.code for p in result.pendencies] == [PendencyCode.FOREIGN_SALE]


def test_a_net_dividend_is_grossed_up_and_the_us_withholding_credited_up_to_15_percent():
    result = report(
        2025,
        [trade('2024-05-24', 'IVV', '1', '2700')],
        [dividend('2025-03-25', 'IVV', '70.00')],
    )

    ivv = item(result, 'IVV')
    assert ivv.dividends_received == D('70.00')
    assert ivv.dividends_gross == D('100.00')
    assert ivv.tax_withheld_abroad == D('30.00')
    assert ivv.tax_paid_abroad == D('15.00')
    assert ivv.income == D('100.00')
    # 15% de 100 é 15, e o crédito cobre tudo: nada a pagar no Brasil.
    assert (result.foreign.tax_due, result.foreign.tax_credit) == (D('15.00'), D('15.00'))
    assert result.foreign.tax_payable == D('0.00')


def test_a_loss_offsets_another_items_gain_and_the_rest_carries_to_the_next_year():
    trades = [
        trade('2024-01-10', 'NU', '10', '100'),
        trade('2024-01-10', 'IVV', '1', '1000'),
        trade('2025-06-01', 'NU', '-10', '50'),  # perda de 500
        trade('2025-06-01', 'IVV', '-1', '1200'),  # ganho de 200
        trade('2026-01-10', 'SCHD', '10', '100'),
        trade('2026-06-01', 'SCHD', '-10', '200'),  # ganho de 1.000
    ]

    year_2025 = report(2025, trades).foreign
    assert (year_2025.gains, year_2025.losses) == (D('200.00'), D('500.00'))
    assert year_2025.loss_carried_out == D('300.00')
    assert year_2025.tax_due == D('0.00')

    year_2026 = report(2026, trades).foreign
    assert year_2026.loss_carried_in == D('300.00')
    assert year_2026.loss_used == D('300.00')
    assert year_2026.taxable_base == D('700.00')
    assert year_2026.tax_due == D('105.00')


def test_the_assets_and_rights_item_carries_the_financial_investment_box():
    result = report(
        2025,
        [
            trade('2024-05-24', 'IVV', '2', '2700', price_usd='540'),
            trade('2025-06-12', 'IVV', '-1', '3000', price_usd='600'),
        ],
        [dividend('2025-09-20', 'IVV', '35.00')],
    )

    (ivv,) = result.assets_and_rights
    assert (ivv.previous_value, ivv.current_value) == (D('5400.00'), D('2700.00'))
    assert ivv.foreign_income == D('350.00')  # 300 da venda + 50 de dividendo bruto
    assert ivv.foreign_tax_paid == D('7.50')
    assert 'US$ 540,00' in ivv.discrimination
    assert 'R$ 5,0000 por dólar' in ivv.discrimination


def test_a_foreign_asset_without_income_still_gets_the_box_zeroed():
    result = report(2025, [trade('2024-05-24', 'IVV', '1', '2700')])

    (ivv,) = result.assets_and_rights
    assert (ivv.foreign_income, ivv.foreign_tax_paid) == (D('0'), D('0'))


def test_a_dividend_after_the_sale_goes_to_the_broker_that_held_the_asset():
    result = report(
        2025,
        [
            trade('2024-05-24', 'IVV', '1', '2700', broker_id=OTHER),
            trade('2025-06-01', 'IVV', '-1', '2800', broker_id=OTHER),
        ],
        [dividend('2025-06-20', 'IVV', '7.00')],
    )

    assert item(result, 'IVV', OTHER).dividends_gross == D('10.00')


def test_foreign_dividends_are_not_left_as_an_unplaced_pendency():
    result = report(
        2025,
        [trade('2024-05-24', 'IVV', '1', '2700')],
        [dividend('2025-03-25', 'IVV', '7.00')],
    )

    assert all(p.code != PendencyCode.NOT_DECLARED_HERE for p in result.pendencies)
    assert result.exempt_income == ()


def test_the_foreign_catalogue_is_valid():
    validate_foreign_catalogue(FOREIGN_RULES)


def test_a_foreign_rule_changing_mid_year_is_refused():
    rule = FOREIGN_RULES[0]
    with pytest.raises(CatalogueError):
        validate_foreign_catalogue([
            ForeignRule(
                valid_from=date(2024, 7, 1),
                valid_until=None,
                rate=rule.rate,
                us_dividend_withholding=rule.us_dividend_withholding,
                source=rule.source,
                checked_on=rule.checked_on,
            )
        ])


def test_two_foreign_rules_at_the_same_time_are_refused():
    rule = FOREIGN_RULES[0]
    with pytest.raises(CatalogueError):
        validate_foreign_catalogue([rule, rule])
