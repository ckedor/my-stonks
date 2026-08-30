"""Wealth-tier schemas."""

from pydantic import BaseModel, ConfigDict


class WealthTier(BaseModel):
    """Um degrau da escala: um título e o preço dele.

    O cenário do degrau não viaja aqui. Ele é um arquivo do repositório,
    escolhido pela posição na escala, então a imagem não é dado de API: nem
    sobe, nem é guardada, nem engorda a resposta que lista a escala inteira.
    """

    rank: int
    name: str
    threshold: float

    model_config = ConfigDict(from_attributes=True)


class WealthTierProjection(BaseModel):
    """Quando o degrau seguinte chega, no ritmo atual.

    As duas entradas viajam junto com a resposta porque a data sozinha não se
    defende: ela vale o que valem o aporte médio e a taxa que a produziram.
    """

    #: Média mensal de aporte na janela recente, na moeda base.
    monthly_contribution: float
    #: Taxa anual da carteira, como fração — 0.12 é 12% ao ano.
    annual_rate: float
    #: Meses até o degrau seguinte.
    months: int
    #: Primeiro dia do mês projetado de chegada, ISO.
    target_date: str


class PortfolioWealthTier(BaseModel):
    """A portfolio's standing on the ladder, from two deliberately different numbers.

    `peak_patrimony` is the highest the portfolio has ever been worth, and it is
    what earns `current_tier`: a rung is reached once and never lost.

    `remaining` and `progress` are measured from `current_patrimony` instead,
    because how much is left to climb is a question about today. A portfolio
    that fell back keeps its title and sees the real distance ahead of it.
    """

    peak_patrimony: float
    current_patrimony: float
    current_tier: WealthTier | None = None
    next_tier: WealthTier | None = None
    remaining: float | None = None
    progress: float
    #: Ausente quando não há degrau seguinte, histórico, ou ritmo que chegue lá.
    projection: WealthTierProjection | None = None
