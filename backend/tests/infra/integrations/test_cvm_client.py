import io
import zipfile
from datetime import UTC, date, datetime
from pathlib import Path

import httpx
import pytest

from app.infra.exceptions import IntegrationBadResponse, IntegrationUnavailable
from app.infra.http import AsyncHttpClient
from app.infra.integrations.cvm_client import (
    CvmClient,
    CvmFile,
    DownloadedFile,
    NotModified,
    NotPublished,
    fidc_share_value_member,
    iter_csv_rows,
)

FIDC_CSV = (
    'TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;DENOM_SOCIAL;DT_COMPTC;TAB_X_CLASSE_SERIE;'
    'TAB_X_QT_COTA;TAB_X_VL_COTA\n'
    'Classe;55.139.905/0001-39;PLGN EQUIPE FIC FIDC;2026-07-31;Subclasse Senior Subclasse 1;'
    '30556890.32564600;1.42053670\n'
).encode('latin-1')


def zipped(members: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def client_for(handler, tmp_path: Path) -> CvmClient:
    http = AsyncHttpClient(provider='cvm', base_url='https://dados.cvm.gov.br/dados', max_retries=0)
    http._client = httpx.AsyncClient(base_url=http.base_url, transport=httpx.MockTransport(handler))
    return CvmClient(http, temp_dir=str(tmp_path))


@pytest.mark.asyncio
async def test_a_downloaded_zip_is_read_row_by_row_and_removed_on_exit(tmp_path):
    body = zipped({
        'inf_mensal_fidc_tab_X_2_202607.csv': FIDC_CSV,
        'inf_mensal_fidc_tab_I_202607.csv': b'IGNORED;\n',
    })

    def handler(request):
        return httpx.Response(
            200,
            content=body,
            headers={'ETag': '"6aab64e8-53824e"', 'Last-Modified': 'Sat, 12 Sep 2026 11:58:00 GMT'},
        )

    client = client_for(handler, tmp_path)
    async with client.download('FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_202607.zip') as result:
        assert isinstance(result, DownloadedFile)
        rows = list(iter_csv_rows(result.path, members=fidc_share_value_member))
        downloaded = result.path

    assert [row['TAB_X_VL_COTA'] for _, row in rows] == ['1.42053670']
    assert rows[0][0] == 'inf_mensal_fidc_tab_X_2_202607.csv'
    assert result.etag == '"6aab64e8-53824e"'
    assert result.last_modified == datetime(2026, 9, 12, 11, 58, tzinfo=UTC)
    assert result.size_bytes == len(body)
    assert len(result.content_version) == 64
    assert not downloaded.exists()
    assert list(tmp_path.iterdir()) == []


@pytest.mark.asyncio
async def test_validators_are_sent_and_a_304_writes_nothing(tmp_path):
    seen = {}

    def handler(request):
        seen.update(request.headers)
        return httpx.Response(304)

    client = client_for(handler, tmp_path)
    async with client.download(
        'FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_202609.zip',
        etag='"abc"',
        last_modified=datetime(2026, 9, 17, 3, 56, 24, tzinfo=UTC),
    ) as result:
        assert isinstance(result, NotModified)

    assert seen['if-none-match'] == '"abc"'
    assert seen['if-modified-since'] == 'Thu, 17 Sep 2026 03:56:24 GMT'
    assert list(tmp_path.iterdir()) == []


@pytest.mark.asyncio
async def test_a_file_not_published_is_reported_as_such_not_as_an_empty_file(tmp_path):
    client = client_for(lambda request: httpx.Response(404), tmp_path)

    async with client.download('FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_202609.zip') as result:
        assert isinstance(result, NotPublished)


@pytest.mark.asyncio
async def test_the_temporary_file_is_removed_when_processing_fails(tmp_path):
    client = client_for(lambda request: httpx.Response(200, content=b'partial'), tmp_path)

    seen: list[Path] = []

    async def process():
        async with client.download('FI/DOC/EXTRATO/DADOS/extrato_fi.csv') as result:
            seen.append(result.path)
            raise RuntimeError('parse failed')

    with pytest.raises(RuntimeError):
        await process()

    assert len(seen) == 1
    assert not seen[0].exists()

    assert list(tmp_path.iterdir()) == []


@pytest.mark.asyncio
async def test_a_server_error_is_an_error_and_leaves_no_file(tmp_path):
    client = client_for(lambda request: httpx.Response(503), tmp_path)

    with pytest.raises(IntegrationUnavailable) as raised:
        async with client.download('FI/CAD/DADOS/registro_fundo_classe.zip'):
            pass

    assert raised.value.status_code == 503

    assert list(tmp_path.iterdir()) == []


def test_a_zip_without_the_expected_member_is_a_bad_response(tmp_path):
    path = tmp_path / 'inf_mensal_fidc_202607.zip'
    path.write_bytes(zipped({'inf_mensal_fidc_tab_I_202607.csv': b'A;B\n1;2\n'}))

    with pytest.raises(IntegrationBadResponse):
        list(iter_csv_rows(path, members=fidc_share_value_member))


LISTING = """
<a href="../">../</a>
<a href="HIST/">HIST/</a>
<a href="inf_mensal_fidc_202501.zip">inf_mensal_fidc_202501.zip</a>
<a href="inf_mensal_fidc_202608.zip">inf_mensal_fidc_202608.zip</a>
"""
HIST_LISTING = """
<a href="../">../</a>
<a href="inf_mensal_fidc_2013.zip">inf_mensal_fidc_2013.zip</a>
<a href="inf_mensal_fidc_2024.zip">inf_mensal_fidc_2024.zip</a>
"""


@pytest.mark.asyncio
async def test_history_is_enumerated_from_both_the_recent_and_the_archive_directories(tmp_path):
    def handler(request):
        if request.url.path.endswith('/HIST/'):
            return httpx.Response(200, text=HIST_LISTING)
        return httpx.Response(200, text=LISTING)

    client = client_for(handler, tmp_path)

    files = await client.list_fidc_monthly_files()

    # Archives sort before recent months: '2024' < '202501' as text and in time.
    assert [file.period for file in files] == ['2013', '2024', '202501', '202608']
    assert files[0] == CvmFile(
        path='FIDC/DOC/INF_MENSAL/DADOS/HIST/inf_mensal_fidc_2013.zip', period='2013'
    )
    archive = next(file for file in files if file.period == '2024')
    assert (archive.first_day, archive.last_day) == (date(2024, 1, 1), date(2024, 12, 31))
    month = next(file for file in files if file.period == '202608')
    assert (month.first_day, month.last_day) == (date(2026, 8, 1), date(2026, 8, 31))


@pytest.mark.asyncio
async def test_an_empty_listing_is_a_bad_response_rather_than_no_history(tmp_path):
    client = client_for(lambda request: httpx.Response(200, text='<html></html>'), tmp_path)

    with pytest.raises(IntegrationBadResponse):
        await client.list_daily_share_value_files()
