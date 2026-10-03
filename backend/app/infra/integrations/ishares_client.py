"""The holdings of an iShares UCITS ETF, from ishares.com.

Not a documented API: it is what the holdings table of each UK product page
loads, column by column. The page is addressed by BlackRock's own product id
and not by ISIN, so each class read needs its line in `PRODUCT_IDS`, taken from
the product page's address (`/uk/individual/en/products/<id>/<slug>`).

The CSV the old product page exported is gone: the address now answers the
page itself. The spreadsheet the new page offers has no ISIN.
"""

from app.infra.http import AsyncHttpClient

PROVIDER = 'ishares'
ISHARES_BASE_URL = 'https://www.ishares.com'
PRODUCT_DATA_PATH = '/varnish-api/uk-retail01-product-data/product-data/api/v2/get-product-data'

#: BlackRock's product id, by the class's ISIN.
PRODUCT_IDS: dict[str, str] = {
    # CSPX: iShares Core S&P 500 UCITS ETF USD (Acc).
    'IE00B5BMR087': '253743',
    # EIMI: iShares Core MSCI EM IMI UCITS ETF USD (Acc).
    'IE00BKM4GZ66': '264659',
}


class IsharesClient:
    def __init__(self, http: AsyncHttpClient | None = None):
        self.http = http or AsyncHttpClient(
            provider=PROVIDER,
            base_url=ISHARES_BASE_URL,
            headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/140.0'},
            timeout=60.0,
            max_retries=2,
        )

    async def close(self) -> None:
        await self.http.aclose()

    async def holdings(self, isin: str) -> dict:
        """The class's latest holdings, as its product page loads them."""
        product_id = PRODUCT_IDS.get(isin)
        if product_id is None:
            raise LookupError(f'No iShares product page is known for {isin}')
        return await self.http.get(
            PRODUCT_DATA_PATH,
            params={
                'appType': 'PRODUCT_PAGE',
                'appSubType': 'ISHARES',
                'component': 'holdings',
                'locale': 'en_GB',
                'targetSite': 'ishares-uk',
                'userType': 'individual',
                'portfolioId': product_id,
                # Empty asks for the latest date.
                'asOfDate': '',
                'excludeContent': 'true',
                'includeConfig': 'true',
            },
        )
