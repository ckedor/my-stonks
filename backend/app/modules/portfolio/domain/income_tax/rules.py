"""As regras de cada regime, com a vigência de cada uma.

Uma regra vale de `valid_from` (inclusive) até `valid_until` (exclusive), e é
escolhida pela data do fato — o dia da venda —, nunca pela data de hoje.
Recalcular um mês antigo depois de uma mudança de lei continua usando a regra
daquele mês.

Não haver regra para um período não é o mesmo que isenção: `rule_for` devolve
`None`, e quem apura transforma isso em pendência. É também por isso que o
catálogo começa onde a fonte foi conferida, e não antes: estender a regra de
hoje para trás seria inventar o passado.

Mudar uma alíquota é fechar a versão atual em `valid_until` e abrir outra no
mesmo dia. Sobreposição para o mesmo regime é erro de catálogo, e
`validate_catalogue` é o que a impede — o teste do catálogo roda ela.

A apuração é mensal, então uma versão começa e termina no primeiro dia de um
mês: o mês inteiro tem uma regra só. Uma lei que mude no meio do mês pede
separar o mês por fato antes de somar, e `validate_catalogue` recusa a versão
até isso existir, em vez de deixar a apuração escolher uma das duas em silêncio.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum
from itertools import pairwise

from app.modules.portfolio.domain.income_tax.trades import TaxAssetKind

#: Quando as fontes abaixo foram conferidas pela última vez.
CHECKED_ON = date(2026, 9, 29)

#: DARF abaixo disto não se recolhe: soma-se ao do mesmo código no período
#: seguinte até alcançar o valor (Lei 9.430/1996, art. 68).
DARF_MINIMUM = Decimal('10.00')
DARF_MINIMUM_SOURCE = 'Lei 9.430/1996, art. 68'


class TaxRegime(StrEnum):
    #: Operações comuns em bolsa: ações, ETFs de renda variável e BDRs. Os três
    #: compensam prejuízo entre si; só a venda de ações tem isenção.
    COMMON = 'common'
    #: Alienação de cotas de FII e Fiagro, com prejuízo próprio.
    REAL_ESTATE_FUND = 'real_estate_fund'
    #: Ganho de capital na alienação de criptoativos custodiados no Brasil.
    CRYPTO = 'crypto'


@dataclass(frozen=True, kw_only=True)
class RateBracket:
    """Uma faixa de alíquota: vale para a parcela do ganho até `up_to`."""

    up_to: Decimal | None
    rate: Decimal


@dataclass(frozen=True, kw_only=True)
class TaxRule:
    regime: TaxRegime
    valid_from: date
    valid_until: date | None
    brackets: tuple[RateBracket, ...]
    #: Vendas no mês até este valor isentam o ganho. Nulo: não há isenção.
    monthly_sales_exemption: Decimal | None
    #: Que vendas contam para o limite e têm o ganho isento. No regime comum
    #: só as ações: ETF e BDR vendidos no mesmo mês não entram na soma nem
    #: ficam isentos.
    exempt_kinds: frozenset[TaxAssetKind]
    #: Se o prejuízo de um mês passa aos seguintes. Em bolsa passa; no ganho
    #: de capital, não.
    carries_losses: bool
    revenue_code: str
    source: str
    checked_on: date

    def applies_on(self, day: date) -> bool:
        return self.valid_from <= day and (self.valid_until is None or day < self.valid_until)

    def tax_on(self, base: Decimal) -> Decimal:
        """O imposto sobre a base, faixa a faixa, antes do arredondamento."""
        tax = Decimal(0)
        floor = Decimal(0)
        for bracket in self.brackets:
            ceiling = bracket.up_to
            if base <= floor:
                break
            parcel = base - floor if ceiling is None else min(base, ceiling) - floor
            tax += parcel * bracket.rate
            if ceiling is None:
                break
            floor = ceiling
        return tax

    @property
    def flat_rate(self) -> Decimal | None:
        """A alíquota, quando há uma só — é o que a tela mostra."""
        return self.brackets[0].rate if len(self.brackets) == 1 else None


_FLAT_15 = (RateBracket(up_to=None, rate=Decimal('0.15')),)
_FLAT_20 = (RateBracket(up_to=None, rate=Decimal('0.20')),)

RULES: tuple[TaxRule, ...] = (
    TaxRule(
        regime=TaxRegime.COMMON,
        # A isenção das ações e os 15% são da Lei 11.033, com efeitos a partir
        # de 2005. Antes dela a alíquota era outra; o catálogo não a tem.
        valid_from=date(2005, 1, 1),
        valid_until=None,
        brackets=_FLAT_15,
        monthly_sales_exemption=Decimal('20000.00'),
        exempt_kinds=frozenset({TaxAssetKind.STOCK}),
        carries_losses=True,
        revenue_code='6015',
        source='Lei 11.033/2004, arts. 2º e 3º, I; IN RFB 1.585/2015',
        checked_on=CHECKED_ON,
    ),
    TaxRule(
        regime=TaxRegime.REAL_ESTATE_FUND,
        # A regra é mais antiga (Lei 9.779/1999); o catálogo começa junto com o
        # da bolsa porque é daí em diante que a fonte foi conferida.
        valid_from=date(2005, 1, 1),
        valid_until=None,
        brackets=_FLAT_20,
        monthly_sales_exemption=None,
        exempt_kinds=frozenset(),
        carries_losses=True,
        revenue_code='6015',
        source='Lei 8.668/1993, art. 18, II, e art. 20-A (Fiagro, Lei 14.130/2021)',
        checked_on=CHECKED_ON,
    ),
    TaxRule(
        regime=TaxRegime.CRYPTO,
        # As faixas progressivas valem para ganhos a partir de 2017. A MP 1.303,
        # que trocaria tudo por 17,5% sem isenção, caiu em outubro de 2025.
        valid_from=date(2017, 1, 1),
        valid_until=None,
        brackets=(
            RateBracket(up_to=Decimal('5000000'), rate=Decimal('0.15')),
            RateBracket(up_to=Decimal('10000000'), rate=Decimal('0.175')),
            RateBracket(up_to=Decimal('30000000'), rate=Decimal('0.20')),
            RateBracket(up_to=None, rate=Decimal('0.225')),
        ),
        monthly_sales_exemption=Decimal('35000.00'),
        exempt_kinds=frozenset({TaxAssetKind.CRYPTO}),
        carries_losses=False,
        revenue_code='4600',
        source=(
            'Lei 8.981/1995, art. 21 (faixas da Lei 13.259/2016); '
            'Lei 9.250/1995, art. 22 (isenção de R$ 35 mil)'
        ),
        checked_on=CHECKED_ON,
    ),
)


class CatalogueError(ValueError):
    """Duas versões da mesma regra valendo no mesmo dia."""


def validate_catalogue(rules: Iterable[TaxRule]) -> None:
    by_regime: dict[TaxRegime, list[TaxRule]] = defaultdict(list)
    for rule in rules:
        if rule.valid_until is not None and rule.valid_until <= rule.valid_from:
            raise CatalogueError(f'{rule.regime}: vigência vazia a partir de {rule.valid_from}')
        for bound in (rule.valid_from, rule.valid_until):
            if bound is not None and bound.day != 1:
                raise CatalogueError(
                    f'{rule.regime}: a vigência muda em {bound}, no meio de um mês'
                )
        by_regime[rule.regime].append(rule)
    for regime, versions in by_regime.items():
        ordered = sorted(versions, key=lambda rule: rule.valid_from)
        for earlier, later in pairwise(ordered):
            if earlier.valid_until is None or earlier.valid_until > later.valid_from:
                raise CatalogueError(
                    f'{regime}: a versão de {earlier.valid_from} e a de {later.valid_from} '
                    'valem ao mesmo tempo'
                )


def rule_for(regime: TaxRegime, day: date, rules: Iterable[TaxRule] = RULES) -> TaxRule | None:
    for rule in rules:
        if rule.regime == regime and rule.applies_on(day):
            return rule
    return None
