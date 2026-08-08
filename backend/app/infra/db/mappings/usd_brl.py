from sqlalchemy import inspect

from app.infra.db.base import Base
from app.infra.db.tables.usd_brl import usd_brl_history_table
from app.modules.market_data.domain.usd_brl import UsdBrlHistory


def map_usd_brl() -> None:
    if inspect(UsdBrlHistory, raiseerr=False) is None:
        Base.registry.map_imperatively(UsdBrlHistory, usd_brl_history_table)
