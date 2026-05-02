"""Asset price quote schemas."""

import datetime
from typing import List, Optional

from pydantic import BaseModel


class OHLCV(BaseModel):
    """Open, High, Low, Close, Volume data point"""
    date: datetime.datetime
    close: float
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    volume: Optional[int] = None


class QuoteResponse(BaseModel):
    """Response containing asset quotes/price history"""
    ticker: str
    asset_type: str
    currency: Optional[str] = None
    quotes: List[OHLCV]
