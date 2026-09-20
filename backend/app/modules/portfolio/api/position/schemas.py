from datetime import datetime

from pydantic import BaseModel


class PortfolioConsolidation(BaseModel):
    """When the portfolio's derived data was last rebuilt.

    `consolidated_at` is when the run finished, not the date the numbers reach:
    that one is bounded by the last quote ingested.
    """

    consolidated_at: datetime
    status: str
    error: str | None = None


class ContributionAverage(BaseModel):
    """Quanto entrou por mês, em média, na história inteira da carteira.

    Um objeto e não um número solto: a rota responde uma leitura da carteira,
    e uma leitura ganha campo com o tempo — um corpo `3909.02` não ganha.

    Na moeda pedida na rota, convertido pelo preço do dia da transação, que é
    o mesmo critério da série de patrimônio.
    """

    monthly_average: float
