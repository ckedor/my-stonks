"""OpenFIGI, Bloomberg's open symbology (openfigi.com).

Used for one question: which ticker an ISIN trades under on an American
exchange. The SEC's holding filings give a position's ISIN and CUSIP but no
ticker, and the asset registry keys American stocks by ticker.

Without a key the service takes 25 requests a minute of 10 ISINs each; with a
free key, 25 every 6 seconds of 100 each. Both limits were checked on
2026-09-26; the key is optional and only makes a large first run faster.
"""

from __future__ import annotations

import asyncio
from collections.abc import Sequence

from app.infra.exceptions import IntegrationBadResponse
from app.infra.http import AsyncHttpClient

PROVIDER = 'openfigi'
MAPPING_URL = 'https://api.openfigi.com/v3/mapping'
#: The composite code for every American exchange.
US_EXCHANGE = 'US'


class OpenFigiClient:
    def __init__(self, api_key: str = '', http: AsyncHttpClient | None = None):
        self.api_key = api_key.strip()
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['X-OPENFIGI-APIKEY'] = self.api_key
        self.http = http or AsyncHttpClient(
            provider=PROVIDER, headers=headers, timeout=60.0, max_retries=2
        )
        self.batch_size = 100 if self.api_key else 10
        self.interval_seconds = 0.25 if self.api_key else 2.5

    async def close(self) -> None:
        await self.http.aclose()

    async def us_tickers(self, isins: Sequence[str]) -> dict[str, set[str]]:
        """ISIN -> the tickers it trades under in the US; absent when none."""
        found: dict[str, set[str]] = {}
        unique = sorted(set(isins))
        for start in range(0, len(unique), self.batch_size):
            batch = unique[start : start + self.batch_size]
            if start:
                await asyncio.sleep(self.interval_seconds)
            body = await self.http.post(
                MAPPING_URL,
                json=[
                    {'idType': 'ID_ISIN', 'idValue': isin, 'exchCode': US_EXCHANGE}
                    for isin in batch
                ],
            )
            if not isinstance(body, list) or len(body) != len(batch):
                raise IntegrationBadResponse('OpenFIGI answered out of shape', provider=PROVIDER)
            for isin, answer in zip(batch, body, strict=True):
                tickers = {
                    str(item['ticker']).strip().upper()
                    for item in (answer or {}).get('data') or []
                    if item.get('ticker')
                }
                if tickers:
                    found[isin] = tickers
        return found
