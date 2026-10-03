"""The holdings list of an Xtrackers ETF, from etf.dws.com.

Not a documented API: it is what the "Holdings" section of each product page
loads, addressed by the class's ISIN. The UK English culture is the one asked
for, which fixes the language of the column labels and the day-first date the
reader expects.

The page also links an xlsx export of the same lines, but that file is dated
only by its sheet's name, which is the day it was exported and not the day the
holdings describe. The JSON states the latter.
"""

from app.infra.http import AsyncHttpClient

PROVIDER = 'dws'
DWS_BASE_URL = 'https://etf.dws.com'


class DwsClient:
    def __init__(self, http: AsyncHttpClient | None = None):
        self.http = http or AsyncHttpClient(
            provider=PROVIDER,
            base_url=DWS_BASE_URL,
            headers={'Accept': 'application/json'},
            timeout=60.0,
            max_retries=2,
        )

    async def close(self) -> None:
        await self.http.aclose()

    async def holdings(self, isin: str) -> dict:
        """The class's holdings tables, as the product page shows them today."""
        return await self.http.get(f'/api/pdp/en-gb/etf/{isin}/holdings')
