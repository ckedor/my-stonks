from sqlalchemy import inspect

from app.infra.db.base import Base
from app.infra.db.tables.asset_visit import asset_visit_table
from app.modules.market_data.domain.asset_visit import AssetVisit


def map_asset_visit() -> None:
    if inspect(AssetVisit, raiseerr=False) is None:
        Base.registry.map_imperatively(AssetVisit, asset_visit_table)
