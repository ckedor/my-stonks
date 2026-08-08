from sqlalchemy import inspect

from app.infra.db.base import Base
from app.infra.db.tables.quote import quote_table
from app.modules.market_data.domain.quote import Quote


def map_quote() -> None:
    if inspect(Quote, raiseerr=False) is not None:
        return

    Base.registry.map_imperatively(
        Quote,
        quote_table,
    )
