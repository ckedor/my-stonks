"""DWS's constituents file for an Xtrackers ETF, from etf.dws.com.

Not a documented API: it is the "export constituents" link on each product
page, addressed by the class's ISIN. The UK English export is the one asked
for, which fixes the language of the headers and the day-first dates the
reader expects.
"""

from app.infra.http import AsyncHttpClient

PROVIDER = 'dws'
DWS_BASE_URL = 'https://etf.dws.com'


class DwsClient:
    def __init__(self, http: AsyncHttpClient | None = None):
        self.http = http or AsyncHttpClient(
            provider=PROVIDER, base_url=DWS_BASE_URL, timeout=60.0, max_retries=2
        )

    async def close(self) -> None:
        await self.http.aclose()

    async def constituents(self, isin: str) -> bytes:
        """The class's constituents spreadsheet, as published today."""
        response = await self.http.get(
            f'/etfdata/export/GBR/ENG/excel/product/constituent/{isin}/', parse='raw'
        )
        return response.content
