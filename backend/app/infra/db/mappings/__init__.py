from app.infra.db.mappings.ai import map_ai
from app.infra.db.mappings.asset_visit import map_asset_visit
from app.infra.db.mappings.assets import map_assets
from app.infra.db.mappings.fund_share_value import map_fund_share_value
from app.infra.db.mappings.ingestion import map_data_ingestion
from app.infra.db.mappings.lab import map_lab
from app.infra.db.mappings.market_data_series import map_market_data_series
from app.infra.db.mappings.operations import map_operations
from app.infra.db.mappings.portfolio import map_portfolio
from app.infra.db.mappings.quote import map_quote
from app.infra.db.mappings.research import map_research
from app.infra.db.mappings.usd_brl import map_usd_brl
from app.infra.db.mappings.users import map_users


def start_mappers() -> None:
    """Register imperative mappings once for domain entities."""
    map_market_data_series()
    map_users()
    map_assets()
    map_portfolio()
    map_asset_visit()
    map_usd_brl()
    map_quote()
    map_fund_share_value()
    map_data_ingestion()
    map_research()
    map_lab()
    map_ai()
    map_operations()


__all__ = ['start_mappers']
