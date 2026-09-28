"""MSCI index levels, from the end-of-day service msci.com's own pages read.

Not a documented API: it is what the site's end-of-day search calls, so it can
change without notice. Two of its habits shape this client. It refuses any
date before 1997-01-01, and it answers a bad parameter with HTTP 200 and the
error inside the body -- read as data, that would be an attempt that succeeded
with no rows.
"""

from datetime import date

from app.infra.exceptions import IntegrationBadResponse
from app.infra.http import AsyncHttpClient

PROVIDER = 'msci'

#: The earliest calculation date the service accepts.
MSCI_EARLIEST_DATE = date(1997, 1, 1)


class MsciIndexClient:
    def __init__(self) -> None:
        self.http = AsyncHttpClient(
            provider=PROVIDER,
            base_url='https://app2.msci.com/products/service/index/indexmaster',
            timeout=30.0,
        )

    async def get_daily_levels(
        self,
        *,
        index_code: str,
        start_date: date,
        end_date: date,
        variant: str = 'NETR',
        currency: str = 'USD',
    ) -> list[dict]:
        """Daily closing levels, oldest first: ``[{'level_eod', 'calc_date'}]``.

        ``variant`` is MSCI's: ``STRD`` is price only, ``NETR`` reinvests
        dividends net of withholding tax, ``GRTR`` gross of it.
        """
        response = await self.http.request(
            'GET',
            '/getLevelDataForGraph',
            params={
                'currency_symbol': currency,
                'index_variant': variant,
                'start_date': max(start_date, MSCI_EARLIEST_DATE).strftime('%Y%m%d'),
                'end_date': end_date.strftime('%Y%m%d'),
                'data_frequency': 'DAILY',
                'index_codes': index_code,
            },
        )
        if not isinstance(response, dict) or response.get('error_message'):
            raise IntegrationBadResponse(
                f'MSCI refused index {index_code}: {response}'[:300],
                provider=PROVIDER,
            )
        levels = (response.get('indexes') or {}).get('INDEX_LEVELS')
        if not isinstance(levels, list):
            raise IntegrationBadResponse(
                f'MSCI answered index {index_code} without levels'[:300],
                provider=PROVIDER,
            )
        return levels

    async def aclose(self) -> None:
        await self.http.aclose()
