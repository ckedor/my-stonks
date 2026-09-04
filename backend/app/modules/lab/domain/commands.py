from dataclasses import dataclass, field
from datetime import date

from app.modules.lab.domain.enums import Frequency


@dataclass(frozen=True, kw_only=True)
class TheoreticalPositionCommand:
    """Uma linha pedida: ou um ativo, ou uma renda fixa sintética."""

    weight: float
    asset_id: int | None = None
    series_id: int | None = None
    fixed_income_type_id: int | None = None
    rate: float | None = None
    label: str | None = None


@dataclass(frozen=True, kw_only=True)
class SaveTheoreticalPortfolioCommand:
    name: str
    initial_amount: float = 10000.0
    contribution_amount: float = 0.0
    contribution_frequency: Frequency = Frequency.NONE
    rebalance_frequency: Frequency = Frequency.NONE
    benchmark_id: int | None = None
    positions: list[TheoreticalPositionCommand] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class RunBacktestCommand:
    """Uma simulação pedida.

    Recebe a alocação inteira em vez do id de uma carteira salva, e é isso que
    deixa a tela simular um rascunho que ninguém salvou — mexer num peso e
    rodar de novo não devia exigir gravar. A carteira salva é a conveniência de
    carregar um destes, não a única origem possível.
    """

    positions: list[TheoreticalPositionCommand] = field(default_factory=list)
    currency: str = 'BRL'
    initial_amount: float = 10000.0
    contribution_amount: float = 0.0
    contribution_frequency: Frequency = Frequency.NONE
    rebalance_frequency: Frequency = Frequency.NONE
    #: A janela: uma data, ou um número de anos contado para trás a partir de
    #: hoje. Os dois preenchidos, a data manda.
    start_date: date | None = None
    years: int | None = None
    end_date: date | None = None
    benchmark_ids: list[int] = field(default_factory=list)
    label: str | None = None


@dataclass(frozen=True, kw_only=True)
class CompareBacktestsCommand:
    """Várias simulações lidas lado a lado.

    É uma rota só porque são a mesma leitura: variar um parâmetro da mesma
    carteira e comparar duas carteiras diferentes produzem o mesmo par de
    curvas na mesma janela. As séries de preço são buscadas uma vez para a
    união das linhas, então a segunda corrida custa quase nada.
    """

    runs: list[RunBacktestCommand] = field(default_factory=list)
