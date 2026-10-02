"""Aplicações financeiras no exterior: a apuração anual da Lei 14.754/2023.

Desde 2024, ação, ETF, REIT e cripto custodiados fora do Brasil são
"aplicações financeiras no exterior". Não há DARF nem apuração mensal: o
rendimento do ano vai para a declaração, item a item da ficha Bens e Direitos,
no quadro "Aplicação Financeira (R$)" — campos "Rendimento ou Perda" e
"Imposto pago no exterior" —, e o programa aplica os 15% (P&R IRPF 2026,
pergunta 474).

Rendimento de um item no ano:

- o resultado das vendas, em reais: valor da venda menos o custo médio do
  contribuinte, os dois na cotação do dia de cada operação — é assim que a
  variação cambial entra no ganho, e é como a transação guarda o preço;
- os dividendos, pelo valor bruto. O provento lançado é o que caiu na conta,
  já sem a retenção dos EUA (decisão de 01/10/2026); o bruto é reconstituído
  e a retenção vira o imposto pago no exterior, compensável até o imposto
  brasileiro sobre o próprio dividendo.

Perda de um item compensa ganho de outro no mesmo ano; o que sobrar passa aos
anos seguintes. Por isso o histórico é apurado desde o primeiro ano com regra,
como os regimes mensais fazem desde a primeira venda.

O resumo do ano (base, imposto, crédito) é a conta que o programa refaz; ele
está aqui para conferência, não para ser digitado.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.modules.portfolio.domain.income_tax.assessment import money
from app.modules.portfolio.domain.income_tax.ledger import (
    RealizedSale,
    holdings_on,
    realize_sales,
)
from app.modules.portfolio.domain.income_tax.pendency import Pendency
from app.modules.portfolio.domain.income_tax.rules import (
    FOREIGN_RULES,
    ForeignRule,
    foreign_rule_for,
    validate_foreign_catalogue,
)
from app.modules.portfolio.domain.income_tax.trades import (
    ClassificationNote,
    CorporateEvent,
    TaxTrade,
)

_ZERO = Decimal(0)

FOREIGN_NOTES = frozenset({ClassificationNote.FOREIGN, ClassificationNote.FOREIGN_CRYPTO})


def is_foreign(trade: TaxTrade) -> bool:
    return trade.note in FOREIGN_NOTES


@dataclass(frozen=True, kw_only=True)
class ForeignDividend:
    """Um provento de ativo no exterior, como foi lançado: o líquido, em reais."""

    asset_id: int
    day: date
    amount: Decimal


@dataclass(frozen=True, kw_only=True)
class ForeignItem:
    """O quadro "Aplicação Financeira (R$)" de um bem: um ativo numa corretora."""

    asset_id: int
    broker_id: int
    ticker: str
    #: Valor bruto das vendas do ano, em reais.
    sales_value: Decimal
    #: Venda menos custo médio, em reais.
    sales_result: Decimal
    #: Dividendos como lançados: o que caiu na conta.
    dividends_received: Decimal
    #: Os mesmos dividendos antes da retenção nos EUA.
    dividends_gross: Decimal
    #: A retenção nos EUA sobre esses dividendos.
    tax_withheld_abroad: Decimal
    #: O campo "Imposto pago no exterior": a retenção, até o imposto
    #: brasileiro sobre o próprio dividendo.
    tax_paid_abroad: Decimal

    @property
    def income(self) -> Decimal:
        """O campo "Rendimento ou Perda"."""
        return self.sales_result + self.dividends_gross


@dataclass(frozen=True, kw_only=True)
class ForeignYear:
    fiscal_year: int
    #: Nula num ano antes da Lei 14.754: não há apuração anual.
    rule: ForeignRule | None
    items: tuple[ForeignItem, ...]
    #: Soma dos itens com rendimento positivo.
    gains: Decimal
    #: Soma dos itens com perda, como número positivo.
    losses: Decimal
    loss_carried_in: Decimal
    loss_used: Decimal
    loss_carried_out: Decimal
    taxable_base: Decimal
    tax_due: Decimal
    #: Imposto pago no exterior que abate o devido; nunca mais que ele.
    tax_credit: Decimal
    tax_payable: Decimal


def assess_foreign(
    *,
    fiscal_year: int,
    trades: Iterable[TaxTrade],
    events: Iterable[CorporateEvent],
    dividends: Iterable[ForeignDividend],
    rules: Iterable[ForeignRule] = FOREIGN_RULES,
) -> tuple[ForeignYear, list[Pendency]]:
    """O ano pedido, com a perda que vem dos anos anteriores desde a lei."""
    rules = tuple(rules)
    validate_foreign_catalogue(rules)
    foreign_trades = tuple(trade for trade in trades if is_foreign(trade))
    events = tuple(events)
    sales, pendencies = realize_sales(foreign_trades, events, include=is_foreign)
    dividends = tuple(dividends)

    first = min((rule.valid_from.year for rule in rules), default=fiscal_year)
    carried = _ZERO
    year = _empty_year(fiscal_year, foreign_rule_for(fiscal_year, rules))
    for current in range(first, fiscal_year + 1):
        rule = foreign_rule_for(current, rules)
        if rule is None:
            carried = _ZERO
            year = _empty_year(current, None)
            continue
        items = _items(current, rule, foreign_trades, events, sales, dividends)
        year = _close_year(current, rule, items, carried)
        carried = year.loss_carried_out

    year_pendencies = [p for p in pendencies if p.day is None or p.day.year == fiscal_year]
    return year, year_pendencies


def _empty_year(fiscal_year: int, rule: ForeignRule | None) -> ForeignYear:
    return ForeignYear(
        fiscal_year=fiscal_year,
        rule=rule,
        items=(),
        gains=_ZERO,
        losses=_ZERO,
        loss_carried_in=_ZERO,
        loss_used=_ZERO,
        loss_carried_out=_ZERO,
        taxable_base=_ZERO,
        tax_due=_ZERO,
        tax_credit=_ZERO,
        tax_payable=_ZERO,
    )


def _items(  # noqa: PLR0913
    year: int,
    rule: ForeignRule,
    trades: tuple[TaxTrade, ...],
    events: tuple[CorporateEvent, ...],
    sales: list[RealizedSale],
    dividends: tuple[ForeignDividend, ...],
) -> list[ForeignItem]:
    tickers = {trade.asset_id: trade.ticker for trade in trades}
    value: dict[tuple[int, int], Decimal] = defaultdict(lambda: _ZERO)
    result: dict[tuple[int, int], Decimal] = defaultdict(lambda: _ZERO)
    for sale in sales:
        if sale.day.year == year:
            key = (sale.asset_id, sale.broker_id)
            value[key] += sale.gross_value
            result[key] += sale.result

    received: dict[tuple[int, int], Decimal] = defaultdict(lambda: _ZERO)
    for dividend in dividends:
        if dividend.day.year != year or dividend.asset_id not in tickers:
            continue
        broker_id = _paying_broker(dividend, trades, events)
        received[(dividend.asset_id, broker_id)] += dividend.amount

    kept = Decimal(1) - rule.us_dividend_withholding
    items = []
    for key in sorted(value.keys() | received.keys()):
        asset_id, broker_id = key
        net = received.get(key, _ZERO)
        gross = net / kept
        withheld = gross - net
        items.append(
            ForeignItem(
                asset_id=asset_id,
                broker_id=broker_id,
                ticker=tickers[asset_id],
                sales_value=money(value.get(key, _ZERO)),
                sales_result=money(result.get(key, _ZERO)),
                dividends_received=money(net),
                dividends_gross=money(gross),
                tax_withheld_abroad=money(withheld),
                tax_paid_abroad=money(min(withheld, gross * rule.rate)),
            )
        )
    return items


def _paying_broker(
    dividend: ForeignDividend, trades: tuple[TaxTrade, ...], events: tuple[CorporateEvent, ...]
) -> int:
    """A corretora que tinha o ativo no dia do provento — o lançamento não diz.

    Com o ativo em mais de uma, a de maior quantidade; sem posição no dia (o
    provento chega depois da venda), a última corretora em que ele foi operado.
    """
    asset_trades = [trade for trade in trades if trade.asset_id == dividend.asset_id]
    held = holdings_on(asset_trades, events, dividend.day)
    if held:
        return max(held, key=lambda holding: holding.quantity).broker_id
    before = [trade for trade in asset_trades if trade.day <= dividend.day] or asset_trades
    return max(before, key=lambda trade: (trade.day, trade.transaction_id)).broker_id


def _close_year(
    year: int, rule: ForeignRule, items: list[ForeignItem], carried_in: Decimal
) -> ForeignYear:
    gains = sum((item.income for item in items if item.income > 0), _ZERO)
    losses = -sum((item.income for item in items if item.income < 0), _ZERO)
    net = gains - losses
    if net <= 0:
        used = _ZERO
        base = _ZERO
        carried_out = carried_in - net
    else:
        used = min(carried_in, net)
        base = net - used
        carried_out = carried_in - used
    tax_due = money(base * rule.rate)
    credit = min(sum((item.tax_paid_abroad for item in items), _ZERO), tax_due)
    return ForeignYear(
        fiscal_year=year,
        rule=rule,
        items=tuple(items),
        gains=money(gains),
        losses=money(losses),
        loss_carried_in=money(carried_in),
        loss_used=money(used),
        loss_carried_out=money(carried_out),
        taxable_base=money(base),
        tax_due=tax_due,
        tax_credit=money(credit),
        tax_payable=money(tax_due - credit),
    )
