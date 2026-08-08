from app.infra.db.mappings.ai import map_ai
from app.infra.db.mappings.assets import map_assets
from app.infra.db.mappings.ingestion import map_data_ingestion
from app.infra.db.mappings.market_data_series import map_market_data_series
from app.infra.db.mappings.portfolio import map_portfolio
from app.infra.db.mappings.quote import map_quote
from app.infra.db.mappings.users import map_users
from app.infra.db.mappings.usd_brl import map_usd_brl


def start_mappers() -> None:
    """Register imperative mappings once for domain entities."""
    map_market_data_series()
    map_users()
    map_assets()
    map_portfolio()
    map_ai()
    map_usd_brl()
    map_quote()
    map_data_ingestion()


__all__ = ['start_mappers']
