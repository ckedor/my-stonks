"""The regulator's open-data files (dados.cvm.gov.br).

This client knows where the files are, how they are packaged and how to read
them as rows. It knows nothing about assets or which rows matter.

What was checked against the published files on 2026-09-17, and why this is
shaped the way it is:

- Every file is ``;``-separated latin-1, zipped except the terms file.
- History is split in two directories. ``DADOS`` holds recent monthly zips and
  ``DADOS/HIST`` holds one zip per older year; the year a month moves from one
  to the other changes as CVM archives it (FIDC 2024 is archived, 2025 is not;
  daily 2020 is archived, 2021 is not). So the available files are read from
  the directory listing on each run, never assumed from a calendar.
- A yearly archive holds either one CSV for the year (daily 2000-2004) or one
  per month (daily 2005-2020, every FIDC year).
- ``ETag`` is nginx's ``mtime-size``, not a content hash, which is why the
  body digest is computed while streaming.
"""

from __future__ import annotations

import calendar
import csv
import io
import re
import tempfile
import zipfile
from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, date, datetime
from email.utils import format_datetime, parsedate_to_datetime
from http import HTTPStatus
from pathlib import Path

from app.infra.exceptions import IntegrationBadResponse
from app.infra.http import AsyncHttpClient

PROVIDER = 'cvm'
CVM_BASE_URL = 'https://dados.cvm.gov.br/dados'

REGISTRY_PATH = 'FI/CAD/DADOS/registro_fundo_classe.zip'
#: The current terms of every fund, one row per CNPJ. The yearly
#: ``extrato_fi_YYYY.csv`` files only hold the filings of that year, so a fund
#: whose terms did not change this year is absent from the current one.
TERMS_PATH = 'FI/DOC/EXTRATO/DADOS/extrato_fi.csv'

DAILY_SHARE_VALUE_DIRECTORY = 'FI/DOC/INF_DIARIO/DADOS'
DAILY_SHARE_VALUE_PREFIX = 'inf_diario_fi_'
FIDC_MONTHLY_DIRECTORY = 'FIDC/DOC/INF_MENSAL/DADOS'
FIDC_MONTHLY_PREFIX = 'inf_mensal_fidc_'
#: The FIDC table carrying outstanding shares and share value per series.
FIDC_SHARE_VALUE_MEMBER_PREFIX = 'inf_mensal_fidc_tab_X_2_'

#: The registry of listed companies: CNPJ, legal and trade name, CVM code and
#: registration status. One snapshot, not a period.
COMPANY_REGISTRY_PATH = 'CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv'
#: The registration form, filed per year. Its ``valor_mobiliario`` member is
#: the only place in CVM open data that ties a negotiation code to a CNPJ.
COMPANY_FORM_DIRECTORY = 'CIA_ABERTA/DOC/FCA/DADOS'
COMPANY_FORM_PREFIX = 'fca_cia_aberta_'
COMPANY_SECURITIES_MEMBER_PREFIX = 'fca_cia_aberta_valor_mobiliario_'

REGISTRY_FUND_MEMBER = 'registro_fundo.csv'
REGISTRY_CLASS_MEMBER = 'registro_classe.csv'
REGISTRY_SUBCLASS_MEMBER = 'registro_subclasse.csv'


def company_form_path(year: int) -> str:
    return f'{COMPANY_FORM_DIRECTORY}/{COMPANY_FORM_PREFIX}{year}.zip'


def company_securities_member(name: str) -> bool:
    return name.startswith(COMPANY_SECURITIES_MEMBER_PREFIX) and name.endswith('.csv')


YEAR_PERIOD_LENGTH = 4

_HREF = re.compile(r'href="([^"?/]+)"')


@dataclass(frozen=True)
class CvmFile:
    """One published file. ``period`` is ``YYYYMM`` or, for an archive, ``YYYY``."""

    path: str
    period: str

    @property
    def is_archive(self) -> bool:
        return len(self.period) == YEAR_PERIOD_LENGTH

    @property
    def first_day(self) -> date:
        year = int(self.period[:4])
        month = 1 if self.is_archive else int(self.period[4:6])
        return date(year, month, 1)

    @property
    def last_day(self) -> date:
        year = int(self.period[:4])
        month = 12 if self.is_archive else int(self.period[4:6])
        return date(year, month, calendar.monthrange(year, month)[1])


@dataclass(frozen=True)
class DownloadedFile:
    """A body on temporary disk. It is deleted when the download context exits."""

    path: Path
    etag: str | None
    last_modified: datetime | None
    size_bytes: int
    content_version: str


@dataclass(frozen=True)
class NotModified:
    """The server confirmed the stored validators still describe the file."""


@dataclass(frozen=True)
class NotPublished:
    """The file is not there (yet). Not the same thing as a file with no rows."""


class CvmClient:
    def __init__(
        self,
        http: AsyncHttpClient | None = None,
        *,
        temp_dir: str | None = None,
    ):
        self.http = http or AsyncHttpClient(
            provider=PROVIDER,
            base_url=CVM_BASE_URL,
            # A monthly daily file is ~11 MB and an archive year up to ~90 MB;
            # the timeout is per read, not for the whole body.
            timeout=120.0,
            max_retries=2,
        )
        self.temp_dir = temp_dir

    async def close(self) -> None:
        await self.http.aclose()

    async def list_daily_share_value_files(self) -> list[CvmFile]:
        return await self._list_period_files(DAILY_SHARE_VALUE_DIRECTORY, DAILY_SHARE_VALUE_PREFIX)

    async def list_fidc_monthly_files(self) -> list[CvmFile]:
        return await self._list_period_files(FIDC_MONTHLY_DIRECTORY, FIDC_MONTHLY_PREFIX)

    async def _list_period_files(self, directory: str, prefix: str) -> list[CvmFile]:
        pattern = re.compile(rf'^{re.escape(prefix)}(\d{{6}}|\d{{4}})\.zip$')
        files: dict[str, CvmFile] = {}
        for listed_directory in (f'{directory}/HIST', directory):
            html = await self.http.get(f'/{listed_directory}/', parse='text')
            for name in _HREF.findall(html):
                match = pattern.match(name)
                if match:
                    period = match.group(1)
                    files[period] = CvmFile(path=f'{listed_directory}/{name}', period=period)
        if not files:
            raise IntegrationBadResponse(
                f'CVM listing of {directory} has no {prefix}* files',
                provider=PROVIDER,
            )
        return sorted(files.values(), key=lambda file: file.period)

    @asynccontextmanager
    async def download(
        self,
        path: str,
        *,
        etag: str | None = None,
        last_modified: datetime | None = None,
    ) -> AsyncIterator[DownloadedFile | NotModified | NotPublished]:
        """Conditionally fetch ``path`` to a temporary file, removed on exit.

        Validators are sent only when given; a caller that must read the body
        regardless passes none.
        """
        headers = {}
        if etag:
            headers['If-None-Match'] = etag
        if last_modified:
            headers['If-Modified-Since'] = format_datetime(
                last_modified.astimezone(UTC), usegmt=True
            )
        handle = tempfile.NamedTemporaryFile(  # noqa: SIM115 - removed in the finally below
            prefix='cvm-', suffix=Path(path).suffix, dir=self.temp_dir, delete=False
        )
        handle.close()
        destination = Path(handle.name)
        try:
            response = await self.http.download(
                f'/{path}',
                destination,
                headers=headers,
                passthrough_statuses=(HTTPStatus.NOT_MODIFIED, HTTPStatus.NOT_FOUND),
            )
            if response.status_code == HTTPStatus.NOT_MODIFIED:
                yield NotModified()
            elif response.status_code == HTTPStatus.NOT_FOUND:
                yield NotPublished()
            else:
                modified = response.headers.get('Last-Modified')
                yield DownloadedFile(
                    path=destination,
                    etag=response.headers.get('ETag'),
                    last_modified=parsedate_to_datetime(modified) if modified else None,
                    size_bytes=response.size_bytes,
                    content_version=response.sha256 or '',
                )
        finally:
            destination.unlink(missing_ok=True)


def iter_csv_rows(
    path: Path,
    *,
    members: Callable[[str], bool] | None = None,
    validate_header: Callable[[str, list[str]], None] | None = None,
) -> Iterator[tuple[str, dict[str, str]]]:
    """Yield ``(member, row)`` one at a time from a CSV or the CSVs in a zip.

    Synchronous and streaming: run it off the event loop. A zip with no member
    accepted by ``members`` is a bad response, not an empty file — reading
    nothing from a file that was supposed to hold rows must not look like
    success.
    """
    if not zipfile.is_zipfile(path):
        if path.suffix == '.zip':
            raise IntegrationBadResponse('CVM response is not a valid ZIP file', provider=PROVIDER)
        with path.open(encoding='latin-1', newline='') as text:
            reader = csv.DictReader(text, delimiter=';')
            if validate_header:
                validate_header(path.name, reader.fieldnames or [])
            for row in reader:
                yield path.name, row
        return
    with zipfile.ZipFile(path) as archive:
        names = [name for name in archive.namelist() if members is None or members(name)]
        if not names:
            raise IntegrationBadResponse(
                f'CVM file {path.name} has none of the expected members',
                provider=PROVIDER,
                context={'members': archive.namelist()[:20]},
            )
        for name in sorted(names):
            with archive.open(name) as raw:
                text = io.TextIOWrapper(raw, encoding='latin-1', newline='')
                reader = csv.DictReader(text, delimiter=';')
                if validate_header:
                    validate_header(name, reader.fieldnames or [])
                for row in reader:
                    yield name, row


def daily_share_value_member(name: str) -> bool:
    return name.startswith(DAILY_SHARE_VALUE_PREFIX) and name.endswith('.csv')


def fidc_share_value_member(name: str) -> bool:
    return name.startswith(FIDC_SHARE_VALUE_MEMBER_PREFIX) and name.endswith('.csv')
