"""The holdings of a Vanguard UCITS ETF, from vanguard.co.uk.

Not a documented API: it is the GraphQL query the UK product page sends for
its holdings table. A fund is addressed by Vanguard's own port id and not by
ISIN, so each class read needs its line in `PORT_IDS`, taken from the product
page's address (`/professional/product/etf/equity/<port id>/<slug>`).

Vanguard publishes the holdings of each month's last day, some weeks later.
The answer comes in pages, chained by the key each one returns.
"""

from app.infra.exceptions import IntegrationBadResponse
from app.infra.http import AsyncHttpClient

PROVIDER = 'vanguard'
VANGUARD_GRAPHQL_URL = 'https://www.vanguard.co.uk/gpx/graphql'

#: Vanguard's port id, by the class's ISIN.
PORT_IDS: dict[str, str] = {
    # VWRA: Vanguard FTSE All-World UCITS ETF (USD) Accumulating.
    'IE00BK5BQT80': '9679',
}

#: A fund of a hundred thousand lines is not one this app holds; a chain
#: longer than this is the server repeating itself.
MAX_PAGES = 60

#: 1500 lines a page, written into the query: the schema has no `Int` type to
#: pass it as a variable.
HOLDINGS_QUERY = """
query FundsHoldingsQuery($portIds: [String!], $lastItemKey: String) {
  borHoldings(portIds: $portIds) {
    holdings(limit: 1500, lastItemKey: $lastItemKey) {
      items {
        securityLongDescription
        isin
        ticker
        bloombergIsoCountry
        marketValuePercentage
        effectiveDate
      }
      totalHoldings
      lastItemKey
    }
  }
}
"""


class VanguardClient:
    def __init__(self, http: AsyncHttpClient | None = None):
        self.http = http or AsyncHttpClient(
            provider=PROVIDER,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 Chrome/140.0',
                # The UK site's consumer, as its own page sends it.
                'x-consumer-id': 'uk0',
            },
            timeout=60.0,
            max_retries=2,
        )

    async def close(self) -> None:
        await self.http.aclose()

    async def holdings(self, isin: str) -> dict:
        """Every line of the fund's latest holdings: `items` from all pages,
        and `totalHoldings` as the first page counts them."""
        port_id = PORT_IDS.get(isin)
        if port_id is None:
            raise LookupError(f'No Vanguard port id is known for {isin}')
        items: list[dict] = []
        total = None
        key = None
        for _ in range(MAX_PAGES):
            body = await self.http.post(
                VANGUARD_GRAPHQL_URL,
                json={
                    'operationName': 'FundsHoldingsQuery',
                    'variables': {'portIds': [port_id], 'lastItemKey': key},
                    'query': HOLDINGS_QUERY,
                },
            )
            try:
                page = body['data']['borHoldings'][0]['holdings']
                items += page['items']
            except (KeyError, IndexError, TypeError) as exc:
                raise IntegrationBadResponse(
                    f'Vanguard answered out of shape: {str(body)[:300]}', provider=PROVIDER
                ) from exc
            total = page.get('totalHoldings') if total is None else total
            key = page.get('lastItemKey')
            if not key:
                return {'totalHoldings': total, 'items': items}
        raise IntegrationBadResponse(
            f'Vanguard holdings for {isin} ran past {MAX_PAGES} pages', provider=PROVIDER
        )
