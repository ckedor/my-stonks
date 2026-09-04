from dataclasses import dataclass, field
from datetime import datetime

from app.modules.lab.domain.enums import Frequency


@dataclass(eq=False, kw_only=True)
class TheoreticalPortfolio:
    """Uma carteira que ninguém comprou.

    É uma alocação com nome: linhas com peso, mais o regime de aportes e de
    rebalanceamento sob o qual uma simulação roda. Pertence ao usuário e nunca
    a uma carteira — não tem operação, não tem posição, e nada dela é
    consolidado.

    O que persiste é o parâmetro. A curva de rentabilidade, o patrimônio
    simulado e a análise saem de um backtest sob demanda e são jogados fora:
    são deriváveis do que já está no banco, e guardá-los criaria uma segunda
    verdade para invalidar toda vez que uma cotação nova chegasse.
    """

    id: int | None = None
    user_id: int
    name: str
    initial_amount: float = 10000.0
    contribution_amount: float = 0.0
    contribution_frequency: Frequency = Frequency.NONE
    rebalance_frequency: Frequency = Frequency.NONE
    #: A série contra a qual a simulação é lida, além do CDI, que entra sempre.
    benchmark_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    positions: list['TheoreticalPosition'] = field(default_factory=list)


@dataclass(eq=False, kw_only=True)
class TheoreticalPosition:
    """Uma linha da carteira teórica, e as três maneiras de ela virar preço.

    Um **ativo** cadastrado tem cotação — persistida, ou buscada no provedor na
    hora de simular. Uma **série** sozinha é exposição ao índice: o IBOVESPA, o
    IFIX, o S&P 500. Uma série **com tipo de rentabilidade e taxa** é renda fixa
    sintética — 110% do CDI, IPCA + 6% —, que é como o laboratório representa um
    CDB ou um Tesouro, instrumentos que não têm cotação nenhuma; e um tipo sem
    série é um prefixado, que não acompanha índice.

    O banco recusa o meio-termo com dois CHECKs. `label` existe só do lado sem
    ativo, porque uma linha "110% do CDI" não tem ticker de onde tirar um nome.
    """

    id: int | None = None
    theoretical_portfolio_id: int | None = None
    weight: float
    asset_id: int | None = None
    series_id: int | None = None
    fixed_income_type_id: int | None = None
    #: 1.10 para 110% de um índice; 0.06 para índice + 6% a.a.; 0.12 para 12%
    #: a.a. prefixado. É a mesma convenção do `fee` da renda fixa cadastrada.
    rate: float | None = None
    label: str | None = None

    @property
    def is_asset(self) -> bool:
        return self.asset_id is not None

    @property
    def is_fixed_income(self) -> bool:
        """Renda fixa sintética: a série entra como taxa, não como nível."""
        return self.asset_id is None and self.fixed_income_type_id is not None
