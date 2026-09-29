import datetime as dt
from dataclasses import dataclass
from enum import StrEnum


class DividendKind(StrEnum):
    """O que o provento é para o imposto, e não para a rentabilidade.

    Para a carteira os dois são dinheiro que entrou. Para a declaração, o
    dividendo é rendimento isento e o JCP é tributado na fonte, em fichas
    diferentes — e só o cadastro sabe qual dos dois a empresa pagou.
    """

    DIVIDEND = 'dividend'
    INTEREST_ON_EQUITY = 'interest_on_equity'


@dataclass(frozen=True, kw_only=True)
class DividendQuery:
    """Criteria for selecting a portfolio's dividends.

    Not a persisted entity: it carries what a caller wants to filter by, so the
    service and the repository can agree on a shape without either of them
    depending on how the request arrived.
    """

    start_date: dt.date | None = None
    end_date: dt.date | None = None
    asset_id: int | None = None
    asset_type_ids: list[int] | None = None

    def __post_init__(self) -> None:
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError('start_date must be <= end_date')
