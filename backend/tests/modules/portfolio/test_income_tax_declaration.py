"""As fichas da declaração contra valores calculados à mão.

Bens e Direitos vai pelo custo, não pelo mercado: o valor de cada item é a
quantidade na corretora vezes o custo médio do contribuinte, que soma todas as
corretoras. Os rendimentos saem por fonte pagadora, no código da ficha.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY
from app.modules.portfolio.domain.income_tax.darf import DarfObligation, DarfStatus
from app.modules.portfolio.domain.income_tax.declaration import (
    AssetRecord,
    BrokerRecord,
    DividendRecord,
    paid_by_regime_month,
)
from app.modules.portfolio.domain.income_tax.pendency import PendencyCode
from app.modules.portfolio.domain.income_tax.report import assess
from app.modules.portfolio.domain.income_tax.rules import TaxRegime
from app.modules.portfolio.domain.income_tax.trades import (
    CorporateEvent,
    TaxAssetKind,
    TaxTrade,
)

pytestmark = pytest.mark.unit

D = Decimal

BROKERS = {
    1: BrokerRecord(broker_id=1, name='XP', cnpj='02332886000104', currency_id=CURRENCY.BRL),
    2: BrokerRecord(broker_id=2, name='BTG', cnpj='43815158000122', currency_id=CURRENCY.BRL),
    3: BrokerRecord(broker_id=3, name='Avenue', cnpj=None, currency_id=CURRENCY.USD),
}


def asset(asset_id, ticker, type_id, **extra) -> AssetRecord:
    return AssetRecord(
        asset_id=asset_id,
        asset_type_id=type_id,
        ticker=ticker,
        name=extra.pop('name', ticker),
        exchange_code=extra.pop('exchange_code', 'B3'),
        **extra,
    )


PETR4 = asset(1, 'PETR4', ASSET_TYPE.STOCK, name='Petrobras', issuer_cnpj='33000167000101')
IMAB11 = asset(2, 'IMAB11', ASSET_TYPE.ETF, etf_segment_id=3, fund_cnpj='13416245000146')
BOVA11 = asset(3, 'BOVA11', ASSET_TYPE.ETF, etf_segment_id=1, fund_cnpj='10406511000161')
HGLG11 = asset(4, 'HGLG11', ASSET_TYPE.FII, name='CSHG Logística', fund_cnpj='11728688000147')
CDB = asset(5, 'CDB C6 2027', ASSET_TYPE.CDB, exchange_code=None)
LCA = asset(6, 'LCA BB 2026', ASSET_TYPE.LCA, exchange_code=None)
BTC = asset(7, 'BTC', ASSET_TYPE.CRIPTO, exchange_code=None)
ETH = asset(8, 'ETH', ASSET_TYPE.CRIPTO, exchange_code=None)
USDT = asset(9, 'USDT', ASSET_TYPE.CRIPTO, exchange_code=None)
AAPL = asset(10, 'AAPL', ASSET_TYPE.STOCK, exchange_code='NASDAQ')
VALE3 = asset(11, 'VALE3', ASSET_TYPE.STOCK, name='Vale')  # sem CNPJ no cadastro
PGBL = asset(12, 'PGBL XP', ASSET_TYPE.PREV, exchange_code=None)
ROXO34 = asset(13, 'ROXO34', ASSET_TYPE.BDR, name='Nubank')
RZAG11 = asset(14, 'RZAG11', ASSET_TYPE.FII, fund_kind='FIAGRO', fund_cnpj='36501128000186')
ASSETS = {
    a.asset_id: a
    for a in (
        PETR4,
        IMAB11,
        BOVA11,
        HGLG11,
        CDB,
        LCA,
        BTC,
        ETH,
        USDT,
        AAPL,
        VALE3,
        PGBL,
        ROXO34,
        RZAG11,
    )
}

_ids = iter(range(1, 100_000))


def trade(day, record, quantity, price, *, broker_id=1, fees='0', kind=TaxAssetKind.STOCK):  # noqa: PLR0913
    return TaxTrade(
        transaction_id=next(_ids),
        portfolio_id=1,
        asset_id=record.asset_id,
        ticker=record.ticker,
        kind=kind,
        broker_id=broker_id,
        day=date.fromisoformat(day),
        quantity=D(quantity),
        price=D(price),
        fees=D(fees),
    )


def report(trades, *, dividends=(), events=(), year=2025):
    return assess(
        fiscal_year=year,
        trades=trades,
        events=events,
        payments=(),
        today=date(2030, 1, 1),
        assets=ASSETS,
        brokers=BROKERS,
        dividends=dividends,
    )


def item_for(result, record, broker_id=1):
    (item,) = [
        i
        for i in result.assets_and_rights
        if i.asset_id == record.asset_id and i.broker_id == broker_id
    ]
    return item


# --- Bens e Direitos -------------------------------------------------------


def test_assets_and_rights_are_valued_at_cost_per_broker():
    result = report([
        trade('2024-05-02', PETR4, '100', '10', fees='2'),  # custo 1.002
        trade(
            '2025-03-03', PETR4, '100', '20', broker_id=2
        ),  # custo médio (1.002 + 2.000) / 200 = 15,01
        trade('2025-06-10', PETR4, '-50', '30'),  # sai da XP; o custo médio não muda
    ])

    xp = item_for(result, PETR4, broker_id=1)
    btg = item_for(result, PETR4, broker_id=2)
    assert (xp.previous_value, xp.current_value) == (D('1002.00'), D('750.50'))  # 50 × 15,01
    assert (btg.previous_value, btg.current_value) == (D('0'), D('1501.00'))  # 100 × 15,01
    assert (xp.group, xp.code, xp.country_code) == ('03', '01', '105')
    assert xp.cnpj == '33.000.167/0001-01'
    assert (xp.ticker, xp.traded_on_exchange) == ('PETR4', True)
    assert xp.discrimination.startswith('50 ações de Petrobras (PETR4)')


def test_a_split_changes_the_quantity_declared_and_not_the_value():
    result = report(
        [trade('2024-05-02', PETR4, '100', '20')],
        events=[CorporateEvent(asset_id=1, day=date(2025, 4, 1), type='SPLIT', factor=D('2'))],
    )

    item = item_for(result, PETR4)
    assert item.previous_value == item.current_value == D('2000.00')
    assert item.discrimination.startswith('200 ações')


def test_an_asset_sold_during_the_year_is_still_declared_with_zero():
    result = report([
        trade('2024-05-02', PETR4, '100', '20'),
        trade('2025-06-10', PETR4, '-100', '25'),
    ])

    item = item_for(result, PETR4)
    assert (item.previous_value, item.current_value) == (D('2000.00'), D('0'))


def test_an_asset_bought_and_sold_within_the_year_is_declared_with_both_zero():
    result = report([
        trade('2025-03-03', PETR4, '100', '20'),
        trade('2025-06-10', PETR4, '-100', '25'),
    ])

    item = item_for(result, PETR4)
    assert (item.previous_value, item.current_value) == (D('0'), D('0'))
    assert 'Comprado e vendido no ano' in item.note


def test_an_asset_closed_before_the_year_is_not_declared():
    result = report([
        trade('2023-03-03', PETR4, '100', '20'),
        trade('2023-06-10', PETR4, '-100', '25'),
    ])

    assert result.assets_and_rights == ()


@pytest.mark.parametrize(
    ('record', 'group', 'code'),
    [
        (IMAB11, '07', '08'),
        (BOVA11, '07', '06'),
        (HGLG11, '07', '03'),
        (RZAG11, '07', '02'),
        (CDB, '04', '02'),
        (LCA, '04', '03'),
        (ROXO34, '04', '04'),
        (BTC, '08', '01'),
        (ETH, '08', '02'),
        (USDT, '08', '03'),
    ],
)
def test_each_asset_gets_the_group_and_code_of_the_form(record, group, code):
    result = report([trade('2025-02-03', record, '1', '100')])

    item = item_for(result, record)
    assert (item.group, item.code) == (group, code)


def test_fixed_income_declares_the_custodian_and_no_ticker():
    item = item_for(report([trade('2025-02-03', CDB, '1', '1000')]), CDB)

    assert item.cnpj == '02.332.886/0001-04'
    assert item.ticker is None
    assert item.country_code == '105'


def test_a_foreign_stock_goes_to_the_united_states_with_a_note():
    item = item_for(report([trade('2025-02-03', AAPL, '10', '1000', broker_id=3)]), AAPL, 3)

    assert (item.group, item.code, item.country_code) == ('03', '01', '249')
    assert item.ticker is None
    assert 'confira' in item.note


def test_a_missing_issuer_cnpj_is_said_not_replaced_by_the_brokers():
    item = item_for(report([trade('2025-02-03', VALE3, '10', '60')]), VALE3)

    assert item.cnpj is None
    assert 'CNPJ da empresa' in item.note


def test_pension_is_left_out_and_said_so():
    result = report([trade('2025-02-03', PGBL, '1', '1000')])

    assert result.assets_and_rights == ()
    assert [p.code for p in result.pendencies] == [PendencyCode.NOT_DECLARED_HERE]


# --- Rendimentos -----------------------------------------------------------


def dividend(record, day, amount, kind='dividend'):
    return DividendRecord(
        asset_id=record.asset_id, day=date.fromisoformat(day), amount=D(amount), kind=kind
    )


def test_dividends_jcp_and_fund_income_go_to_their_codes_by_payer():
    result = report(
        [trade('2024-02-03', PETR4, '100', '30'), trade('2024-02-03', HGLG11, '10', '160')],
        dividends=[
            dividend(PETR4, '2025-03-10', '120.50'),
            dividend(PETR4, '2025-08-10', '79.50'),
            dividend(PETR4, '2025-09-10', '45.00', kind='interest_on_equity'),
            dividend(HGLG11, '2025-01-15', '11.00'),
            dividend(HGLG11, '2025-02-15', '11.00'),
            dividend(PETR4, '2024-12-10', '99.00'),  # outro ano
        ],
    )

    exempt = {(line.code, line.payer_cnpj): line.amount for line in result.exempt_income}
    assert exempt == {
        ('09', '33.000.167/0001-01'): D('200.00'),
        ('99', '11.728.688/0001-47'): D('22.00'),
    }
    (jcp,) = result.exclusive_income
    assert (jcp.code, jcp.payer_name, jcp.amount) == ('10', 'Petrobras', D('45.00'))


def test_exempt_gains_of_the_year_are_one_line_each():
    result = report([
        # Mar: 10.000 de vendas, ganho 2.000 isento.
        trade('2025-03-03', PETR4, '100', '80'),
        trade('2025-03-20', PETR4, '-100', '100'),
        # Mai: cripto vende 30.000, ganho 5.000 isento.
        trade('2025-05-03', BTC, '1', '25000', kind=TaxAssetKind.CRYPTO),
        trade('2025-05-20', BTC, '-1', '30000', kind=TaxAssetKind.CRYPTO),
    ])

    exempt = {line.code: line.amount for line in result.exempt_income}
    assert exempt == {'20': D('2000.00'), '05': D('5000.00')}


def test_a_bdr_dividend_is_a_pendency_not_an_exempt_dividend():
    result = report(
        [trade('2024-02-03', ROXO34, '10', '5')],
        dividends=[dividend(ROXO34, '2025-03-10', '3.00')],
    )

    assert result.exempt_income == ()
    assert [p.code for p in result.pendencies] == [PendencyCode.NOT_DECLARED_HERE]


# --- Renda Variável e GCAP -------------------------------------------------


def _obligation(amount, paid, by_regime):
    return DarfObligation(
        revenue_code='6015',
        period=date(2025, 3, 1),
        due_date=date(2025, 4, 30),
        by_regime=tuple(by_regime),
        carried_in=D(0),
        amount=D(amount),
        carried_out=D(0),
        paid_principal=D(paid),
        payments=(),
        status=DarfStatus.PAID,
    )


def test_a_paid_darf_is_split_between_the_regimes_it_joined():
    by_regime = [(TaxRegime.COMMON, D('60')), (TaxRegime.REAL_ESTATE_FUND, D('40'))]

    full = paid_by_regime_month([_obligation('100', '100', by_regime)])
    partial = paid_by_regime_month([_obligation('100', '50', by_regime)])

    assert full[(TaxRegime.COMMON, date(2025, 3, 1))] == D('60.00')
    assert full[(TaxRegime.REAL_ESTATE_FUND, date(2025, 3, 1))] == D('40.00')
    assert partial[(TaxRegime.COMMON, date(2025, 3, 1))] == D('30.00')


def test_only_crypto_sales_of_taxed_months_go_to_the_capital_gains_program():
    result = report([
        trade('2025-02-03', BTC, '1', '30000', kind=TaxAssetKind.CRYPTO),
        trade('2025-02-20', BTC, '-0.5', '40000', kind=TaxAssetKind.CRYPTO),  # 20.000: isento
        trade('2025-03-20', BTC, '-0.5', '80000', kind=TaxAssetKind.CRYPTO),  # 40.000: tributado
    ])

    (operation,) = result.capital_gains
    assert operation.day == date(2025, 3, 20)
    assert (operation.sale_value, operation.acquisition_cost, operation.capital_gain) == (
        D('40000.00'),
        D('15000.00'),
        D('25000.00'),
    )
