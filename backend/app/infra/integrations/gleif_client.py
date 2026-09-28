"""GLEIF, the register of legal entity identifiers (gleif.org).

Two reads, checked against what GLEIF served on 2026-09-25:

- The relationship golden copy: every relationship between LEIs, one CSV of
  ~490k rows zipped to ~23 MB, republished three times a day. It is where a
  fund's manager (`IS_FUND-MANAGED_BY`) and umbrella (`IS_SUBFUND_OF`) are.
  Asking the API one fund at a time would be thousands of calls under a limit
  of 60 a minute; the file is one download.
- The LEI records, by the API, two hundred LEIs per call: the legal name and
  the jurisdiction of each entity the relationships name.
"""

from __future__ import annotations

import tempfile
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path

from app.infra.exceptions import IntegrationBadResponse
from app.infra.http import AsyncHttpClient

PROVIDER = 'gleif'
API_URL = 'https://api.gleif.org/api/v1'
LATEST_GOLDEN_COPY_URL = 'https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest'
#: The API's largest page.
LEI_BATCH_SIZE = 200


class GleifClient:
    def __init__(self, http: AsyncHttpClient | None = None, *, temp_dir: str | None = None):
        self.http = http or AsyncHttpClient(provider=PROVIDER, timeout=120.0, max_retries=2)
        self.temp_dir = temp_dir

    async def close(self) -> None:
        await self.http.aclose()

    @asynccontextmanager
    async def relationships(self) -> AsyncIterator[Path]:
        """The latest relationship golden copy on temporary disk."""
        latest = await self.http.get(LATEST_GOLDEN_COPY_URL)
        try:
            url = latest['data']['rr']['full_file']['csv']['url']
        except (KeyError, TypeError) as exc:
            raise IntegrationBadResponse(
                'GLEIF golden copy listing has no relationship file', provider=PROVIDER
            ) from exc
        handle = tempfile.NamedTemporaryFile(  # noqa: SIM115 - removed in the finally below
            prefix='gleif-rr-', suffix='.zip', dir=self.temp_dir, delete=False
        )
        handle.close()
        destination = Path(handle.name)
        try:
            await self.http.download(url, destination)
            yield destination
        finally:
            destination.unlink(missing_ok=True)

    async def lei_records(self, leis: Sequence[str]) -> list[dict]:
        """The LEI records GLEIF has for ``leis``; an unknown LEI is just absent."""
        records: list[dict] = []
        unique = sorted(set(leis))
        for start in range(0, len(unique), LEI_BATCH_SIZE):
            batch = unique[start : start + LEI_BATCH_SIZE]
            body = await self.http.get(
                f'{API_URL}/lei-records',
                params={'filter[lei]': ','.join(batch), 'page[size]': LEI_BATCH_SIZE},
            )
            data = (body or {}).get('data')
            if data is None:
                raise IntegrationBadResponse(
                    'GLEIF LEI records answer has no data', provider=PROVIDER
                )
            records.extend(data)
        return records
