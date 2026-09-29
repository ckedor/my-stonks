"""Apuração mensal de cada regime, do primeiro mês com venda até o fim do ano pedido.

O histórico inteiro é percorrido porque o prejuízo a compensar em janeiro é o
de dezembro anterior, e o de dezembro vem de todos os meses antes dele. Um mês
sem venda também é apurado: ele carrega o saldo adiante sem mudá-lo, e a tela
mostra os doze.

Regime comum, mês a mês:

1. vendas de ações somam para o limite; se ficam no limite e o resultado das
   ações é ganho, esse ganho é isento — e não consome prejuízo;
2. o resto (ações fora da isenção, ETFs, BDRs, perdas de ações em mês isento)
   forma o resultado do mês;
3. perda aumenta o prejuízo a compensar; ganho o consome, e o que sobra é base;
4. o IRRF retido nas vendas abate o imposto; o que não couber passa aos meses
   seguintes do mesmo ano, e o de dezembro vai para a declaração.

FII segue os mesmos passos, sem isenção e com prejuízo próprio. Cripto é ganho
de capital: cada venda com ganho é tributada, perda não compensa nada, e o mês
inteiro fica isento se as vendas de criptoativos somarem até o limite.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from app.modules.portfolio.domain.income_tax.ledger import RealizedSale
from app.modules.portfolio.domain.income_tax.pendency import Pendency, PendencyCode
from app.modules.portfolio.domain.income_tax.rules import RULES, TaxRegime, TaxRule, rule_for
from app.modules.portfolio.domain.income_tax.trades import TaxAssetKind

_ZERO = Decimal(0)
_CENT = Decimal('0.01')

REGIME_OF_KIND: dict[TaxAssetKind, TaxRegime] = {
    TaxAssetKind.STOCK: TaxRegime.COMMON,
    TaxAssetKind.EQUITY_ETF: TaxRegime.COMMON,
    TaxAssetKind.BDR: TaxRegime.COMMON,
    TaxAssetKind.REAL_ESTATE_FUND: TaxRegime.REAL_ESTATE_FUND,
    TaxAssetKind.CRYPTO: TaxRegime.CRYPTO,
}

_REGIME_LABEL = {
    TaxRegime.COMMON: 'operações comuns',
    TaxRegime.REAL_ESTATE_FUND: 'FII',
    TaxRegime.CRYPTO: 'criptoativos',
}


def money(value: Decimal) -> Decimal:
    return value.quantize(_CENT, rounding=ROUND_HALF_UP)


def month_of(day: date) -> date:
    return day.replace(day=1)


def next_month(month: date) -> date:
    return date(month.year + month.month // 12, month.month % 12 + 1, 1)


@dataclass(frozen=True, kw_only=True)
class MonthlyAssessment:
    regime: TaxRegime
    #: Primeiro dia do mês apurado.
    month: date
    rule: TaxRule | None
    #: Valor de todas as vendas do regime no mês.
    sales: Decimal
    #: As vendas que contam para o limite de isenção (ações, cripto).
    exemption_sales: Decimal
    #: Se as vendas que contam ficaram no limite.
    within_exemption: bool
    #: Soma dos resultados das vendas, antes de isenção e compensação.
    result: Decimal
    exempt_gain: Decimal
    loss_carried_in: Decimal
    loss_used: Decimal
    loss_carried_out: Decimal
    taxable_base: Decimal
    tax_due: Decimal
    withheld_in_month: Decimal
    withheld_carried_in: Decimal
    withheld_used: Decimal
    withheld_carried_out: Decimal
    #: Imposto devido menos IRRF — antes do mínimo de DARF.
    tax_payable: Decimal

    @property
    def net_result(self) -> Decimal:
        """O resultado que vai para a ficha de Renda Variável: sem o ganho isento.

        O ganho isento das ações vai para Rendimentos Isentos (código 20), e
        declará-lo também aqui seria contá-lo duas vezes.
        """
        return self.result - self.exempt_gain


@dataclass(frozen=True, kw_only=True)
class RegimeHistory:
    regime: TaxRegime
    months: tuple[MonthlyAssessment, ...]


def assess_regimes(
    sales: Iterable[RealizedSale],
    until: date,
    rules: Iterable[TaxRule] = RULES,
) -> tuple[dict[TaxRegime, RegimeHistory], list[Pendency]]:
    """Todos os meses de cada regime, do primeiro com venda até `until` (inclusive)."""
    rules = tuple(rules)
    by_regime_month: dict[TaxRegime, dict[date, list[RealizedSale]]] = {
        regime: defaultdict(list) for regime in TaxRegime
    }
    for sale in sales:
        regime = REGIME_OF_KIND.get(sale.kind)
        if regime is not None and sale.day <= until:
            by_regime_month[regime][month_of(sale.day)].append(sale)

    histories: dict[TaxRegime, RegimeHistory] = {}
    pendencies: list[Pendency] = []
    for regime, by_month in by_regime_month.items():
        months, regime_pendencies = _assess_regime(regime, by_month, month_of(until), rules)
        histories[regime] = RegimeHistory(regime=regime, months=tuple(months))
        pendencies.extend(regime_pendencies)
    return histories, pendencies


def _assess_regime(
    regime: TaxRegime,
    by_month: dict[date, list[RealizedSale]],
    last_month: date,
    rules: tuple[TaxRule, ...],
) -> tuple[list[MonthlyAssessment], list[Pendency]]:
    months: list[MonthlyAssessment] = []
    pendencies: list[Pendency] = []
    loss = _ZERO
    withheld = _ZERO
    # O ano pedido sai inteiro mesmo sem venda nele: "sem movimento" é uma
    # resposta, e a tela mostra os doze meses.
    month = min([*by_month, last_month.replace(month=1)])
    while month <= last_month:
        if month.month == 1:
            # O IRRF só se compensa dentro do ano; o que sobrou em dezembro já
            # foi para a declaração.
            withheld = _ZERO
        month_sales = by_month.get(month, [])
        rule = rule_for(regime, month, rules)
        if rule is None and month_sales:
            pendencies.append(
                Pendency(
                    code=PendencyCode.NO_RULE,
                    message=(
                        f'Vendas de {_REGIME_LABEL[regime]} em {month:%m/%Y}: '
                        'não há regra cadastrada para esse período, e o mês não foi apurado.'
                    ),
                    day=month,
                    transaction_ids=tuple(sale.transaction_id for sale in month_sales),
                )
            )
        assessment = _assess_month(regime, month, rule, month_sales, loss, withheld)
        months.append(assessment)
        loss = assessment.loss_carried_out
        withheld = assessment.withheld_carried_out
        month = next_month(month)
    return months, pendencies


def _assess_month(  # noqa: PLR0913
    regime: TaxRegime,
    month: date,
    rule: TaxRule | None,
    sales: list[RealizedSale],
    loss_in: Decimal,
    withheld_in: Decimal,
) -> MonthlyAssessment:
    total_sales = sum((sale.gross_value for sale in sales), _ZERO)
    result = sum((sale.result for sale in sales), _ZERO)
    withheld_month = sum((sale.withheld_income_tax for sale in sales), _ZERO)

    if rule is None:
        return MonthlyAssessment(
            regime=regime,
            month=month,
            rule=None,
            sales=total_sales,
            exemption_sales=_ZERO,
            within_exemption=False,
            result=result,
            exempt_gain=_ZERO,
            loss_carried_in=loss_in,
            loss_used=_ZERO,
            loss_carried_out=loss_in,
            taxable_base=_ZERO,
            tax_due=_ZERO,
            withheld_in_month=withheld_month,
            withheld_carried_in=withheld_in,
            withheld_used=_ZERO,
            withheld_carried_out=withheld_in + withheld_month,
            tax_payable=_ZERO,
        )

    exemption_group = [sale for sale in sales if sale.kind in rule.exempt_kinds]
    exemption_sales = sum((sale.gross_value for sale in exemption_group), _ZERO)
    within_exemption = (
        rule.monthly_sales_exemption is not None and exemption_sales <= rule.monthly_sales_exemption
    )

    if rule.carries_losses:
        exemption_result = sum((sale.result for sale in exemption_group), _ZERO)
        exempt_gain = exemption_result if within_exemption and exemption_result > 0 else _ZERO
        month_result = result - exempt_gain
        if month_result < 0:
            loss_used = _ZERO
            loss_out = loss_in - month_result
            base = _ZERO
        else:
            loss_used = min(loss_in, month_result)
            loss_out = loss_in - loss_used
            base = month_result - loss_used
    else:
        # Ganho de capital: cada venda com ganho é tributada por si, e a perda
        # de uma não abate o ganho de outra.
        gains = sum((sale.result for sale in sales if sale.result > 0), _ZERO)
        exempt_gain = gains if within_exemption else _ZERO
        base = _ZERO if within_exemption else gains
        loss_used = _ZERO
        loss_out = _ZERO

    tax_due = money(rule.tax_on(base))
    available = withheld_in + withheld_month
    withheld_used = min(available, tax_due)
    return MonthlyAssessment(
        regime=regime,
        month=month,
        rule=rule,
        sales=total_sales,
        exemption_sales=exemption_sales,
        within_exemption=within_exemption,
        result=result,
        exempt_gain=exempt_gain,
        loss_carried_in=loss_in,
        loss_used=loss_used,
        loss_carried_out=loss_out,
        taxable_base=base,
        tax_due=tax_due,
        withheld_in_month=withheld_month,
        withheld_carried_in=withheld_in,
        withheld_used=withheld_used,
        withheld_carried_out=available - withheld_used,
        tax_payable=tax_due - withheld_used,
    )
