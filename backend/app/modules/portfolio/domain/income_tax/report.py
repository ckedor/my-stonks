"""A apuração de um ano-calendário, pronta para as abas da tela.

É aqui que os passos se encadeiam: classificar já veio feito nos fatos; o livro
realiza as vendas; cada regime é apurado desde o começo do histórico; os DARFs
saem da apuração; e as pendências de todos os passos são juntadas. As abas
recortam este resultado — nenhuma calcula de novo.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.modules.portfolio.domain.income_tax.assessment import (
    REGIME_OF_KIND,
    MonthlyAssessment,
    assess_regimes,
)
from app.modules.portfolio.domain.income_tax.darf import (
    DarfObligation,
    DarfPayment,
    build_obligations,
)
from app.modules.portfolio.domain.income_tax.ledger import (
    RealizedSale,
    find_day_trades,
    realize_sales,
)
from app.modules.portfolio.domain.income_tax.pendency import Pendency, PendencyCode
from app.modules.portfolio.domain.income_tax.rules import (
    RULES,
    TaxRegime,
    TaxRule,
    validate_catalogue,
)
from app.modules.portfolio.domain.income_tax.trades import (
    ClassificationNote,
    CorporateEvent,
    TaxTrade,
)

_NOTE_PENDENCY = {
    ClassificationNote.FOREIGN: (
        PendencyCode.FOREIGN_SALE,
        'Venda de {ticker} no exterior ({count}): aplicações no exterior têm apuração '
        'anual (Lei 14.754/2023), que esta apuração ainda não faz.',
    ),
    ClassificationNote.FOREIGN_CRYPTO: (
        PendencyCode.FOREIGN_CRYPTO_SALE,
        'Venda de {ticker} em corretora de base dólar ({count}): cripto custodiada no '
        'exterior tem apuração anual (Lei 14.754/2023), que esta apuração ainda não faz.',
    ),
    ClassificationNote.LISTED_FUND: (
        PendencyCode.LISTED_FUND_SALE,
        'Venda de {ticker} ({count}): fundo listado que não é FII nem Fiagro no cadastro '
        'do regulador. FI-Infra, FIP e outros têm regime próprio, não apurado aqui.',
    ),
    ClassificationNote.ETF_WITHOUT_SEGMENT: (
        PendencyCode.ETF_WITHOUT_SEGMENT,
        'Venda de {ticker} ({count}): o ETF não tem segmento no cadastro e foi apurado como '
        'ETF de ações. Se for de renda fixa, o imposto é retido na fonte — classifique-o.',
    ),
}


@dataclass(frozen=True, kw_only=True)
class IncomeTaxReport:
    fiscal_year: int
    #: Os doze meses do ano, por regime.
    months: dict[TaxRegime, tuple[MonthlyAssessment, ...]]
    #: As vendas do ano que o livro realizou, inclusive as de ETF de renda
    #: fixa, que ficam fora do DARF.
    sales: tuple[RealizedSale, ...]
    #: Os DARFs cujo mês de apuração cai no ano.
    obligations: tuple[DarfObligation, ...]
    pendencies: tuple[Pendency, ...]

    def year_end(self, regime: TaxRegime) -> MonthlyAssessment | None:
        months = self.months.get(regime, ())
        return months[-1] if months else None

    @property
    def losses_to_carry(self) -> dict[TaxRegime, Decimal]:
        """O prejuízo a compensar no fim do ano, que vai para a declaração."""
        return {
            regime: month.loss_carried_out
            for regime in self.months
            if (month := self.year_end(regime)) is not None
        }

    @property
    def withheld_to_declare(self) -> dict[TaxRegime, Decimal]:
        """O IRRF que sobrou no ano e se compensa na declaração de ajuste."""
        return {
            regime: month.withheld_carried_out
            for regime in self.months
            if (month := self.year_end(regime)) is not None
        }


def assess(  # noqa: PLR0913
    *,
    fiscal_year: int,
    trades: Iterable[TaxTrade],
    events: Iterable[CorporateEvent],
    payments: Iterable[DarfPayment],
    today: date,
    rules: Iterable[TaxRule] = RULES,
) -> IncomeTaxReport:
    rules = tuple(rules)
    validate_catalogue(rules)
    trades = tuple(trades)
    year_start = date(fiscal_year, 1, 1)
    year_end = date(fiscal_year, 12, 31)

    def in_year(day: date | None) -> bool:
        return day is None or year_start <= day <= year_end

    sales, ledger_pendencies = realize_sales(trades, events)
    histories, rule_pendencies = assess_regimes(sales, until=year_end, rules=rules)
    all_months = [month for history in histories.values() for month in history.months]
    obligations, payment_pendencies = build_obligations(
        all_months,
        [payment for payment in payments if payment.period <= year_end],
        today,
    )

    year_sales = tuple(sale for sale in sales if in_year(sale.day))
    pendencies = [
        *(pendency for pendency in ledger_pendencies if in_year(pendency.day)),
        *(pendency for pendency in find_day_trades(trades) if in_year(pendency.day)),
        *_classification_pendencies(trade for trade in trades if in_year(trade.day)),
        *_missing_fees_pendency(sale for sale in year_sales if sale.kind in REGIME_OF_KIND),
        *(pendency for pendency in rule_pendencies if in_year(pendency.day)),
        *(pendency for pendency in payment_pendencies if in_year(pendency.day)),
    ]

    return IncomeTaxReport(
        fiscal_year=fiscal_year,
        months={
            regime: tuple(month for month in history.months if month.month.year == fiscal_year)
            for regime, history in histories.items()
        },
        sales=year_sales,
        obligations=tuple(
            obligation for obligation in obligations if obligation.period.year == fiscal_year
        ),
        pendencies=tuple(pendencies),
    )


def _classification_pendencies(trades: Iterable[TaxTrade]) -> list[Pendency]:
    sales_by_note: dict[tuple[ClassificationNote, int], list[TaxTrade]] = defaultdict(list)
    for trade in trades:
        if trade.is_sale and trade.note is not None:
            sales_by_note[(trade.note, trade.asset_id)].append(trade)

    pendencies = []
    for (note, asset_id), group in sales_by_note.items():
        code, template = _NOTE_PENDENCY[note]
        count = len(group)
        pendencies.append(
            Pendency(
                code=code,
                message=template.format(
                    ticker=group[0].ticker,
                    count='1 venda' if count == 1 else f'{count} vendas',
                ),
                day=group[0].day,
                asset_id=asset_id,
                ticker=group[0].ticker,
                transaction_ids=tuple(trade.transaction_id for trade in group),
            )
        )
    return pendencies


def _missing_fees_pendency(sales: Iterable[RealizedSale]) -> list[Pendency]:
    missing = [sale for sale in sales if not sale.fees_informed]
    if not missing:
        return []
    count = len(missing)
    return [
        Pendency(
            code=PendencyCode.MISSING_FEES,
            message=(
                f'{"1 venda" if count == 1 else f"{count} vendas"} sem taxas informadas, na '
                'própria venda ou nas compras que formam o custo. Taxa não informada foi '
                'apurada como zero, o que deixa o resultado maior; importar a nota de '
                'corretagem completa as taxas.'
            ),
            transaction_ids=tuple(sale.transaction_id for sale in missing),
        )
    ]
