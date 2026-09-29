"""Do imposto apurado ao DARF: um por código de receita e mês, e o que já foi pago.

Obrigação, recolhimento e declaração são três coisas. O imposto do mês é a
apuração; o DARF junta os regimes que pagam pelo mesmo código (bolsa comum e
FII são ambos 6015) e aplica o mínimo de R$ 10 — abaixo dele o valor não se
paga e passa ao mês seguinte do mesmo código, sem virar isento. O pagamento é
um fato que a pessoa registra: nunca se presume que um imposto calculado foi
pago.

Multa e juros de um DARF em atraso não são calculados aqui: dependem da data em
que se vai pagar e da Selic acumulada até lá, e é o Sicalc quem os fecha.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from app.modules.portfolio.domain.income_tax.assessment import (
    MonthlyAssessment,
    next_month,
)
from app.modules.portfolio.domain.income_tax.calendar import darf_due_date
from app.modules.portfolio.domain.income_tax.pendency import Pendency, PendencyCode
from app.modules.portfolio.domain.income_tax.rules import DARF_MINIMUM, TaxRegime

_ZERO = Decimal(0)


@dataclass(eq=False, kw_only=True)
class DarfPayment:
    """Um DARF pago, como a pessoa o registrou. É do usuário, não de uma carteira."""

    id: int | None = None
    user_id: int
    revenue_code: str
    #: Primeiro dia do mês de apuração a que o pagamento se refere.
    period: date
    paid_on: date
    principal: Decimal
    fine: Decimal = _ZERO
    interest: Decimal = _ZERO
    created_at: datetime | None = None


class DarfStatus(StrEnum):
    #: Abaixo do mínimo: o valor passa para o mês seguinte.
    BELOW_MINIMUM = 'below_minimum'
    PAID = 'paid'
    PARTIALLY_PAID = 'partially_paid'
    OPEN = 'open'
    OVERDUE = 'overdue'


@dataclass(frozen=True, kw_only=True)
class DarfObligation:
    revenue_code: str
    period: date
    due_date: date
    #: O imposto a pagar de cada regime com este código, no mês.
    by_regime: tuple[tuple[TaxRegime, Decimal], ...]
    #: Valores abaixo do mínimo trazidos de meses anteriores.
    carried_in: Decimal
    #: Imposto do mês mais o que veio de antes.
    amount: Decimal
    #: O que não chegou ao mínimo e passa adiante.
    carried_out: Decimal
    paid_principal: Decimal
    payments: tuple[DarfPayment, ...]
    status: DarfStatus

    @property
    def balance(self) -> Decimal:
        if self.status == DarfStatus.BELOW_MINIMUM:
            return _ZERO
        return max(self.amount - self.paid_principal, _ZERO)


def build_obligations(
    months: Iterable[MonthlyAssessment],
    payments: Iterable[DarfPayment],
    today: date,
) -> tuple[list[DarfObligation], list[Pendency]]:
    """Os DARFs de todo o histórico apurado, mês a mês e código a código."""
    tax_by_code: dict[str, dict[date, dict[TaxRegime, Decimal]]] = defaultdict(
        lambda: defaultdict(dict)
    )
    for month in months:
        if month.rule is not None and month.tax_payable > 0:
            tax_by_code[month.rule.revenue_code][month.month][month.regime] = month.tax_payable

    payments_by_key: dict[tuple[str, date], list[DarfPayment]] = defaultdict(list)
    for payment in payments:
        payments_by_key[(payment.revenue_code, payment.period)].append(payment)

    obligations: list[DarfObligation] = []
    for code, by_month in tax_by_code.items():
        carried = _ZERO
        period = min(by_month)
        # Um pagamento do acumulado pode cair depois do último mês com imposto.
        last = max([*by_month, *(key[1] for key in payments_by_key if key[0] == code)])
        while period <= last:
            regimes = by_month.get(period, {})
            tax = sum(regimes.values(), _ZERO)
            period_payments = tuple(payments_by_key.pop((code, period), ()))
            if tax == 0 and not period_payments:
                # Nada no mês: o que está abaixo do mínimo espera o próximo imposto.
                period = next_month(period)
                continue
            amount = carried + tax
            obligation = _obligation(code, period, regimes, carried, amount, period_payments, today)
            obligations.append(obligation)
            carried = obligation.carried_out
            period = next_month(period)

    pendencies = [
        Pendency(
            code=PendencyCode.PAYMENT_WITHOUT_OBLIGATION,
            message=(
                f'Pagamento de DARF {payment.revenue_code} de {payment.period:%m/%Y} registrado, '
                'mas a apuração não tem imposto a pagar nesse código e mês.'
            ),
            day=payment.paid_on,
        )
        for key_payments in payments_by_key.values()
        for payment in key_payments
    ]
    obligations.sort(key=lambda obligation: (obligation.period, obligation.revenue_code))
    return obligations, pendencies


def _obligation(  # noqa: PLR0913
    code: str,
    period: date,
    regimes: dict[TaxRegime, Decimal],
    carried_in: Decimal,
    amount: Decimal,
    payments: tuple[DarfPayment, ...],
    today: date,
) -> DarfObligation:
    paid = sum((payment.principal for payment in payments), _ZERO)
    due = darf_due_date(period)
    below_minimum = amount < DARF_MINIMUM and not payments
    if below_minimum:
        status = DarfStatus.BELOW_MINIMUM
    elif paid >= amount:
        status = DarfStatus.PAID
    elif paid > 0:
        status = DarfStatus.PARTIALLY_PAID
    elif due < today:
        status = DarfStatus.OVERDUE
    else:
        status = DarfStatus.OPEN
    return DarfObligation(
        revenue_code=code,
        period=period,
        due_date=due,
        by_regime=tuple(sorted(regimes.items())),
        carried_in=carried_in,
        amount=amount,
        carried_out=amount if below_minimum else _ZERO,
        paid_principal=paid,
        payments=payments,
        status=status,
    )
