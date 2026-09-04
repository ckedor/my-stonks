from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True, kw_only=True)
class BacktestPoint:
    """Um dia da simulação."""

    date: date
    #: O patrimônio ao fim do dia, já com o fluxo de caixa do dia dentro.
    value: float
    #: Quanto entrou de dinheiro até aqui, valor inicial incluído.
    invested: float
    #: O retorno acumulado desde o início, composto e limpo de aporte.
    acc_return: float


@dataclass(frozen=True, kw_only=True)
class BacktestLineResult:
    """O que uma linha virou no fim da simulação."""

    key: str
    label: str
    target_weight: float
    final_weight: float
    final_value: float


@dataclass(frozen=True, kw_only=True)
class BacktestWindow:
    """A janela que a simulação conseguiu rodar, e por que não foi maior.

    O backtest começa no primeiro dia em que **toda** linha tem preço, senão a
    carteira dos primeiros meses não é a carteira que se pediu. `limited_by` é
    a linha que impôs esse começo: é a informação que deixa alguém decidir se
    troca a linha ou encurta a ambição.
    """

    start_date: date
    end_date: date
    limited_by: str | None = None
    requested_start_date: date | None = None


@dataclass(frozen=True, kw_only=True)
class BacktestResult:
    """O resultado de uma simulação. Não é persistido.

    Precede qualquer decisão de guardá-lo: é derivado das cotações e das séries
    que já estão no banco, e recalcular é barato. O que se guarda da carteira
    teórica é o parâmetro que produziu isto.
    """

    label: str | None = None
    window: BacktestWindow
    series: list[BacktestPoint] = field(default_factory=list)
    lines: list[BacktestLineResult] = field(default_factory=list)
    final_value: float
    invested: float
    profit: float
    contributions: int
    rebalances: int
    #: O payload de `calculate_returns_analysis`: o mesmo que a carteira real
    #: entrega, para a tela ler os dois com os mesmos componentes.
    analysis: dict | None = None
