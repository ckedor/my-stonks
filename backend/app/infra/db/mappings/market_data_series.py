from sqlalchemy import inspect
from sqlalchemy.orm import relationship

from app.infra.db.base import Base
from app.infra.db.tables.market_data_series import (
    market_data_series_history_table,
    market_data_series_table,
)
from app.modules.market_data.domain.market_data_series import (
    MarketDataSeries,
    MarketDataSeriesHistory,
)


def map_market_data_series() -> None:
    if inspect(MarketDataSeries, raiseerr=False) is None:
        Base.registry.map_imperatively(
            MarketDataSeries,
            market_data_series_table,
            properties={'currency': relationship('Currency', lazy='joined')},
        )

    if inspect(MarketDataSeriesHistory, raiseerr=False) is None:
        Base.registry.map_imperatively(
            MarketDataSeriesHistory,
            market_data_series_history_table,
            properties={'series': relationship(MarketDataSeries, lazy='joined')},
        )
