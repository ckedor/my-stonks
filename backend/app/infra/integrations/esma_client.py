"""FIRDS, ESMA's register of instruments traded on European venues.

Every UCITS ETF traded anywhere in the EU is in it, one document per ISIN per
venue — 241k documents for 11.5k ETF ISINs, as served on 2026-09-25. The
register answers a Solr query, so the ETFs are asked for by their CFI group
(`CE*`) and grouped by ISIN on the server, one document back per class.

London is not in it. The UK left FIRDS with Brexit, and a class traded only in
London comes back `TERM` on the LSE's MIC; the same class traded on Xetra or
Euronext is still active, which covers the London ETFs worth registering.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from app.infra.exceptions import IntegrationBadResponse
from app.infra.http import AsyncHttpClient

PROVIDER = 'esma'
FIRDS_URL = 'https://registers.esma.europa.eu/solr/esma_registers_firds/select'

#: Every ETF class still traded somewhere, except the American ones: an
#: American fund is the SEC's, and it is registered from there.
ETF_QUERY = 'gnr_cfi_code:CE* AND -status:TERM AND -isin:US*'
FIELDS = ('isin', 'lei', 'gnr_full_name', 'gnr_cfi_code', 'gnr_notional_curr_code')
#: A page takes ~13 s to answer; a thousand keeps the whole set to six pages.
PAGE_SIZE = 1000


class EsmaClient:
    def __init__(self, http: AsyncHttpClient | None = None):
        self.http = http or AsyncHttpClient(provider=PROVIDER, timeout=120.0, max_retries=2)

    async def close(self) -> None:
        await self.http.aclose()

    async def etf_classes(self) -> AsyncIterator[list[dict]]:
        """Pages of one FIRDS document per active ETF class."""
        start = 0
        while True:
            body = await self.http.get(
                FIRDS_URL,
                params={
                    'q': ETF_QUERY,
                    'wt': 'json',
                    'rows': PAGE_SIZE,
                    'start': start,
                    # Stable order, or a page boundary can skip or repeat a class.
                    'sort': 'isin asc',
                    'group': 'true',
                    'group.field': 'isin',
                    'group.limit': 1,
                    'group.ngroups': 'true',
                    'fl': ','.join(FIELDS),
                },
            )
            grouped = (body or {}).get('grouped', {}).get('isin')
            if grouped is None or 'groups' not in grouped:
                raise IntegrationBadResponse(
                    'FIRDS answer has no grouping by ISIN', provider=PROVIDER
                )
            groups = grouped['groups']
            if not groups:
                return
            yield [group['doclist']['docs'][0] for group in groups if group['doclist']['docs']]
            start += len(groups)
            if start >= grouped.get('ngroups', 0):
                return
