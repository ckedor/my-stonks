from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


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


class ClosedPositionEntry(BaseModel):
    """Um ativo que a carteira teve e não tem mais.

    Traz as duas leituras do domínio juntas: o dinheiro realizado na ida e
    volta e o retorno ponderado no tempo no último dia de exposição.
    """

    asset_id: int
    ticker: str | None
    name: str
    type: str
    category: str | None
    entry_date: date
    exit_date: date
    days_held: int
    quantity_sold: float
    average_price: float
    average_sale_price: float
    total_invested: float
    gross_sales: float
    realized_profit: float
    realized_profit_pct: float | None
    dividends: float
    acc_return: float | None
    cagr: float | None

    model_config = ConfigDict(from_attributes=True)
