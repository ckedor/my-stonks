"""A apuração de um ano-calendário, pronta para as abas da tela.

É aqui que os passos se encadeiam: classificar já veio feito nos fatos; o livro
realiza as vendas; cada regime é apurado desde o começo do histórico; os DARFs
saem da apuração; e as pendências de todos os passos são juntadas. As abas
recortam este resultado — nenhuma calcula de novo.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
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
from app.modules.portfolio.domain.income_tax.declaration import (
    AssetRecord,
    AssetsAndRightsItem,
    BrokerRecord,
    CapitalGainOperation,
    DividendRecord,
    IncomeLine,
    assets_and_rights,
    capital_gain_operations,
    income_lines,
    paid_by_regime_month,
)
from app.modules.portfolio.domain.income_tax.foreign import (
    ForeignDividend,
    ForeignYear,
    assess_foreign,
    is_foreign,
)
from app.modules.portfolio.domain.income_tax.ledger import (
    RealizedSale,
    find_day_trades,
    realize_sales,
)
from app.modules.portfolio.domain.income_tax.pendency import Pendency, PendencyCode
from app.modules.portfolio.domain.income_tax.rules import (
    FOREIGN_RULES,
    RULES,
    ForeignRule,
    TaxRegime,
    TaxRule,
    foreign_rule_for,
    validate_catalogue,
)
from app.modules.portfolio.domain.income_tax.trades import (
    ClassificationNote,
    CorporateEvent,
    TaxTrade,
)

#: Vendas no exterior só viram pendência num ano sem a regra anual: antes de
#: 2024 eram ganho de capital, que o catálogo não tem.
_NOTE_PENDENCY = {
    ClassificationNote.FOREIGN: (
        PendencyCode.FOREIGN_SALE,
        'Venda de {ticker} no exterior ({count}): antes da Lei 14.754/2023 era ganho de '
        'capital apurado no GCAP, regime que esta apuração não tem.',
    ),
    ClassificationNote.FOREIGN_CRYPTO: (
        PendencyCode.FOREIGN_CRYPTO_SALE,
        'Venda de {ticker} em corretora de base dólar ({count}): antes da Lei 14.754/2023 '
        'era ganho de capital apurado no GCAP, regime que esta apuração não tem.',
    ),
    ClassificationNote.LISTED_FUND: (
        PendencyCode.LISTED_FUND_SALE,
        'Venda de {ticker} ({count}): fundo listado que não é FII nem Fiagro no cadastro '
        'do regulador. FI-Infra, FIP e outros têm regime próprio, não apurado aqui.',
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
    #: As fichas da declaração, campo a campo.
    assets_and_rights: tuple[AssetsAndRightsItem, ...] = ()
    exempt_income: tuple[IncomeLine, ...] = ()
    exclusive_income: tuple[IncomeLine, ...] = ()
    capital_gains: tuple[CapitalGainOperation, ...] = ()
    #: O imposto pago de cada mês de Renda Variável, por regime.
    tax_paid: dict[tuple[TaxRegime, date], Decimal] = field(default_factory=dict)
    #: A apuração anual das aplicações no exterior.
    foreign: ForeignYear | None = None

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
    assets: dict[int, AssetRecord] | None = None,
    brokers: dict[int, BrokerRecord] | None = None,
    dividends: Iterable[DividendRecord] = (),
    foreign_rules: Iterable[ForeignRule] = FOREIGN_RULES,
) -> IncomeTaxReport:
    """A apuração do ano.

    `dividends` traz os proventos do ano e, para o exterior, os dos anos
    anteriores desde a lei: a perda que um ano passa ao seguinte depende deles.
    """
    rules = tuple(rules)
    foreign_rules = tuple(foreign_rules)
    validate_catalogue(rules)
    trades = tuple(trades)
    events = tuple(events)
    dividends = tuple(dividends)
    foreign_assets = {trade.asset_id for trade in trades if is_foreign(trade)}
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
        *_classification_pendencies(
            trade
            for trade in trades
            if in_year(trade.day)
            and not (is_foreign(trade) and foreign_rule_for(fiscal_year, foreign_rules))
        ),
        *_missing_fees_pendency(sale for sale in year_sales if sale.kind in REGIME_OF_KIND),
        *(pendency for pendency in rule_pendencies if in_year(pendency.day)),
        *(pendency for pendency in payment_pendencies if in_year(pendency.day)),
    ]

    year_months = {
        regime: tuple(month for month in history.months if month.month.year == fiscal_year)
        for regime, history in histories.items()
    }
    year_obligations = tuple(
        obligation for obligation in obligations if obligation.period.year == fiscal_year
    )

    foreign, foreign_pendencies = assess_foreign(
        fiscal_year=fiscal_year,
        trades=trades,
        events=events,
        dividends=[
            ForeignDividend(asset_id=d.asset_id, day=d.day, amount=d.amount)
            for d in dividends
            if d.asset_id in foreign_assets
        ],
        rules=foreign_rules,
    )
    pendencies += foreign_pendencies

    items: list[AssetsAndRightsItem] = []
    exempt: list[IncomeLine] = []
    exclusive: list[IncomeLine] = []
    if assets is not None and brokers is not None:
        items, asset_pendencies = assets_and_rights(
            fiscal_year=fiscal_year,
            trades=trades,
            events=events,
            assets=assets,
            brokers=brokers,
            foreign=foreign,
        )
        exempt, exclusive, income_pendencies = income_lines(
            fiscal_year=fiscal_year,
            dividends=[d for d in dividends if d.asset_id not in foreign_assets],
            assets=assets,
            months=year_months,
        )
        pendencies += asset_pendencies + income_pendencies

    return IncomeTaxReport(
        fiscal_year=fiscal_year,
        months=year_months,
        sales=year_sales,
        obligations=year_obligations,
        pendencies=tuple(pendencies),
        assets_and_rights=tuple(items),
        exempt_income=tuple(exempt),
        exclusive_income=tuple(exclusive),
        capital_gains=tuple(
            capital_gain_operations(year_sales, year_months.get(TaxRegime.CRYPTO, ()))
        ),
        tax_paid=paid_by_regime_month(year_obligations),
        foreign=foreign,
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
