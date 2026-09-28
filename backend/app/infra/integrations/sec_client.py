"""The SEC's open data about registered funds (sec.gov).

Two sources, both checked against what the SEC served on 2026-09-25:

- ``company_tickers_mf.json`` maps every current fund ticker to its CIK, series
  and class — 28,550 rows, mutual funds and ETFs alike. It says nothing about
  what a fund is; it is the ticker list and nothing more.
- The N-CEN data sets say what a fund is: whether it is an ETF, whether it
  tracks an index, who advises it, which trust it belongs to, all with LEIs.
  One zip per calendar quarter, of ~8 MB, holding the filings made in it. A
  fund files once a year, at the end of its own fiscal year, so a single
  quarter holds about a quarter of the ETFs and the last four hold them all.

The SEC refuses requests that do not name who is asking: its fair-access policy
wants a User-Agent with a contact, and answers 403 without one.
"""

from __future__ import annotations

import asyncio
import re
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import date
from http import HTTPStatus
from pathlib import Path

from app.infra.exceptions import IntegrationBadResponse
from app.infra.http import AsyncHttpClient

PROVIDER = 'sec'
SEC_BASE_URL = 'https://www.sec.gov'
SUBMISSIONS_URL = 'https://data.sec.gov/submissions/CIK{cik:010d}.json'
#: EDGAR's full-text search. The only index that finds a series' own filing:
#: a trust files one N-PORT per series, hundreds a quarter under one CIK, and
#: its submissions list does not say which series each one is.
FULL_TEXT_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index'
NPORT_FORM = 'NPORT-P'
NCEN_FORM = 'N-CEN'
#: The fair-access limit is ten requests a second; this stays well under it.
REQUEST_INTERVAL_SECONDS = 0.2

FUND_TICKERS_PATH = '/files/company_tickers_mf.json'
FUND_TICKERS_FIELDS = ['cik', 'seriesId', 'classId', 'symbol']


def ncen_path(year: int, quarter: int) -> str:
    return f'/files/dera/data/form-n-cen-data-sets/{year}q{quarter}_ncen.zip'


_SERIES_ID = re.compile(r'<SERIES-ID>(S\d{9})')


@dataclass(frozen=True)
class NcenFiling:
    cik: int
    #: Without dashes, as the archive path spells it.
    accession: str
    filed: date


@dataclass(frozen=True)
class NportFiling:
    cik: int
    #: Without dashes, as the archive path spells it.
    accession: str
    period: date
    filed: date


class SecClient:
    def __init__(
        self,
        user_agent: str,
        http: AsyncHttpClient | None = None,
        *,
        temp_dir: str | None = None,
    ):
        self.user_agent = user_agent.strip()
        self.http = http or AsyncHttpClient(
            provider=PROVIDER,
            base_url=SEC_BASE_URL,
            headers={'User-Agent': self.user_agent},
            timeout=120.0,
            max_retries=2,
        )
        self.temp_dir = temp_dir

    async def close(self) -> None:
        await self.http.aclose()

    def _require_identity(self) -> None:
        # Checked on use and not on construction, so a missing setting fails
        # the run's attempt, where it is recorded, instead of the worker boot.
        if not self.user_agent:
            raise IntegrationBadResponse(
                'SEC_USER_AGENT is not set; the SEC refuses anonymous requests',
                provider=PROVIDER,
            )

    async def fund_tickers(self) -> list[list]:
        """``[cik, series id, class id, ticker]`` for every current fund class."""
        self._require_identity()
        body = await self.http.get(FUND_TICKERS_PATH)
        if not isinstance(body, dict) or body.get('fields') != FUND_TICKERS_FIELDS:
            raise IntegrationBadResponse(
                'SEC fund ticker file changed shape',
                provider=PROVIDER,
                context={'fields': body.get('fields') if isinstance(body, dict) else None},
            )
        return body.get('data') or []

    @asynccontextmanager
    async def ncen_quarter(self, year: int, quarter: int) -> AsyncIterator[Path | None]:
        """One quarter's N-CEN zip on temporary disk, or None if not published yet."""
        self._require_identity()
        handle = tempfile.NamedTemporaryFile(  # noqa: SIM115 - removed in the finally below
            prefix='sec-ncen-', suffix='.zip', dir=self.temp_dir, delete=False
        )
        handle.close()
        destination = Path(handle.name)
        try:
            response = await self.http.download(
                ncen_path(year, quarter),
                destination,
                passthrough_statuses=(HTTPStatus.NOT_FOUND,),
            )
            yield None if response.status_code == HTTPStatus.NOT_FOUND else destination
        finally:
            destination.unlink(missing_ok=True)

    async def ncen_filings(self, cik: int) -> list[NcenFiling]:
        """A trust's N-CEN filings, newest first, from EDGAR's submissions index.

        The JSON index at data.sec.gov answers in half a second. The older
        company browser answers the same question in two seconds, or in two
        minutes with a 503, which is why it is not used.
        """
        self._require_identity()
        await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
        index = await self.http.get(SUBMISSIONS_URL.format(cik=cik))
        recent = ((index or {}).get('filings') or {}).get('recent') or {}
        filings = [
            NcenFiling(
                cik=cik,
                accession=accession.replace('-', ''),
                filed=date.fromisoformat(filed),
            )
            for form, accession, filed in zip(
                recent.get('form') or [],
                recent.get('accessionNumber') or [],
                recent.get('filingDate') or [],
                strict=False,
            )
            if form == NCEN_FORM
        ]
        return sorted(filings, key=lambda filing: filing.filed, reverse=True)

    async def ncen_series(self, filing: NcenFiling) -> set[str]:
        """The series a filing reports, from its SGML header — ~15 KB, not ~1 MB."""
        self._require_identity()
        await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
        dashed = f'{filing.accession[:10]}-{filing.accession[10:12]}-{filing.accession[12:]}'
        header = await self.http.get(
            f'/Archives/edgar/data/{filing.cik}/{filing.accession}/{dashed}.hdr.sgml',
            parse='text',
        )
        return set(_SERIES_ID.findall(header or ''))

    async def ncen_document(self, filing: NcenFiling) -> bytes:
        """The filing's XML document — not the XSL rendering, which is HTML."""
        self._require_identity()
        await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
        response = await self.http.get(
            f'/Archives/edgar/data/{filing.cik}/{filing.accession}/primary_doc.xml', parse='raw'
        )
        return response.content

    async def latest_nport(self, series_id: str) -> NportFiling | None:
        """The N-PORT filing of ``series_id`` for the latest period, if any.

        The search matches the series id anywhere in a document, so the
        caller confirms the series in the document it reads. Of two filings
        for one period, the later one is an amendment and wins.
        """
        self._require_identity()
        await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
        body = await self.http.get(
            FULL_TEXT_SEARCH_URL, params={'q': f'"{series_id}"', 'forms': NPORT_FORM}
        )
        hits = ((body or {}).get('hits') or {}).get('hits') or []
        filings = []
        for hit in hits:
            source = hit.get('_source') or {}
            try:
                filings.append(
                    NportFiling(
                        cik=int((source.get('ciks') or ['0'])[0]),
                        accession=str(source['adsh']).replace('-', ''),
                        period=date.fromisoformat(source['period_ending']),
                        filed=date.fromisoformat(source['file_date']),
                    )
                )
            except (KeyError, TypeError, ValueError):
                continue
        if not filings:
            return None
        return max(filings, key=lambda filing: (filing.period, filing.filed))

    async def nport_document(self, filing: NportFiling) -> bytes:
        self._require_identity()
        await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
        response = await self.http.get(
            f'/Archives/edgar/data/{filing.cik}/{filing.accession}/primary_doc.xml', parse='raw'
        )
        return response.content
