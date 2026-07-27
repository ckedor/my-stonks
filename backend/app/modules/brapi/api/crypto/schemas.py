"""Query schemas for brapi Criptomoedas endpoints."""

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class CryptoQuery(BrapiQuery):
    coin: str | None = Field(
        default=None,
        description='Sigla(s) das criptomoedas separadas por vírgula',
        examples=['BTC,ETH'],
    )

    currency: str | None = Field(
        default=None,
        description='Moeda para cotação (padrão: BRL)',
        examples=['BRL'],
    )

    range: str | None = Field(
        default=None,
        description='Período para dados históricos',
    )

    interval: str | None = Field(
        default=None,
        description='Intervalo dos dados históricos',
    )


class CryptoAvailableQuery(BrapiQuery):
    search: str | None = Field(
        default=None,
        description='Filtrar criptomoedas por símbolo',
        examples=['BTC'],
    )
