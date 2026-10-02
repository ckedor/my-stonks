"""The holdings CSV of an iShares UCITS ETF, from ishares.com.

Not a documented API: it is the "download holdings" link on each UK product
page. The page is addressed by BlackRock's own product id and not by ISIN, so
each class read needs its line in `PRODUCTS`, taken from the product page's
address. The site turns away clients that do not look like a browser, hence
the User-Agent, the same one the Status Invest client sends.
"""

from dataclasses import dataclass

from app.infra.http import AsyncHttpClient

PROVIDER = 'ishares'
ISHARES_BASE_URL = 'https://www.ishares.com'
#: The same on every product page: it names the download, not the fund.
HOLDINGS_AJAX = '1506575576011.ajax'


@dataclass(frozen=True)
class IsharesProduct:
    product_id: str
    #: The page's slug, as its address spells it.
    slug: str
    #: Only names the downloaded file.
    ticker: str


#: By the class's ISIN.
PRODUCTS: dict[str, IsharesProduct] = {
    'IE00B5BMR087': IsharesProduct('253743', 'ishares-sp-500-b-ucits-etf-acc-fund', 'CSPX'),
    'IE00BKM4GZ66': IsharesProduct('264659', 'ishares-msci-emerging-markets-imi-ucits-etf', 'EIMI'),
}


class IsharesClient:
    def __init__(self, http: AsyncHttpClient | None = None):
        self.http = http or AsyncHttpClient(
            provider=PROVIDER,
            base_url=ISHARES_BASE_URL,
            headers={'User-Agent': 'Chrome/112.0.0.0'},
            timeout=60.0,
            max_retries=2,
        )

    async def close(self) -> None:
        await self.http.aclose()

    async def holdings(self, isin: str) -> bytes:
        """The class's holdings CSV, as published today."""
        product = PRODUCTS.get(isin)
        if product is None:
            raise LookupError(f'No iShares product page is known for {isin}')
        response = await self.http.get(
            f'/uk/individual/en/products/{product.product_id}/{product.slug}/{HOLDINGS_AJAX}',
            params={
                'fileType': 'csv',
                'fileName': f'{product.ticker}_holdings',
                'dataType': 'fund',
                # Past the "are you a professional investor" gate.
                'siteEntryPassthrough': 'true',
            },
            parse='raw',
        )
        return response.content
