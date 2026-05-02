"""
Market Data Module

Handles market indexes, exchange rates (USD/BRL), asset price quotes,
asset metadata and brokers.

Structure:
- api/: FastAPI routes and Pydantic schemas (asset, broker, market_data)
- service/: Business logic layer
- repositories/: Database access layer
- tasks/: Celery background tasks
- domain/: Domain models and business rules (if needed)
"""

from app.modules.market_data.api import router

__all__ = ['router']
