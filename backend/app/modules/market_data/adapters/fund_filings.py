"""Regulator files read as fund registry rows and share-value filings.

Column names, value spellings and file layouts stop here. What was checked
against the published files and their dictionaries on 2026-09-17:

- ``registro_fundo.csv`` repeats a fund once per manager (1,050 funds had more
  than one row, identical except for the manager). The repeats are adjacent,
  and they are merged; a repeat that is not adjacent cannot be merged without
  holding the whole file, so it fails the file instead of dropping a manager.
- ``registro_classe.csv`` had four exact duplicate rows; the first one wins.
- The daily share-value file has three column layouts: ``TP_FUNDO`` absent
  (up to 2004), ``TP_FUNDO`` + ``CNPJ_FUNDO`` (to 2023-11), and
  ``TP_FUNDO_CLASSE`` + ``CNPJ_FUNDO_CLASSE`` + ``ID_SUBCLASSE`` (from 2023-12).
- The FIDC table ``tab_X_2`` moved from ``CNPJ_FUNDO`` to
  ``CNPJ_FUNDO_CLASSE`` on 2023-12. Its published dictionary still lists
  ``CNPJ_FUNDO``, so the header is checked here rather than the dictionary
  trusted.
- A FIDC may file the same series twice in a month, once as ``Fundo`` and once
  as ``Classe``. Identical repeats collapse; repeats that disagree are a
  conflict, decided in the domain.
- Old FIDC filings carry absurd share values (398,991,407,407.41). They are
  parsed as published; the domain refuses what cannot be a price.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import TypeVar

from app.infra.exceptions import IntegrationBadResponse
from app.infra.integrations.cvm_client import (
    PROVIDER,
    REGISTRY_CLASS_MEMBER,
    REGISTRY_FUND_MEMBER,
    REGISTRY_SUBCLASS_MEMBER,
    CvmClient,
    CvmFile,
    daily_share_value_member,
    fidc_share_value_member,
    iter_csv_rows,
)
from app.modules.market_data.domain.fund_registry import digits
from app.modules.market_data.domain.fund_share_value import (
    PublishedFile,
    ShareValueDataset,
    ShareValueFiling,
)

REGISTRY_BATCH_SIZE = 2000

T = TypeVar('T')


def _text(value: str | None, limit: int | None = None) -> str | None:
    value = (value or '').strip()
    if not value:
        return None
    return value[:limit] if limit else value


def _date(value: str | None) -> date | None:
    value = (value or '').strip()
    return date.fromisoformat(value) if value else None


def _decimal(value: str | None) -> Decimal | None:
    value = (value or '').strip()
    if not value:
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def _int(value: str | None) -> int | None:
    number = _decimal(value)
    return int(number) if number is not None else None


def _yes_no(value: str | None) -> bool | None:
    return {'S': True, 'N': False}.get((value or '').strip().upper())


def _open_ended(value: str | None) -> bool | None:
    return {'ABERTO': True, 'FECHADO': False}.get((value or '').strip().upper())


def _require(member: str, row: dict[str, str], columns: Iterable[str]) -> None:
    missing = [column for column in columns if column not in row]
    if missing:
        raise IntegrationBadResponse(
            f'CVM file member {member} lacks columns {", ".join(missing)}',
            provider=PROVIDER,
        )


def _batches(rows: Iterable[T], size: int) -> Iterator[list[T]]:
    batch: list[T] = []
    for row in rows:
        batch.append(row)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


async def iterate_off_loop(iterator: Iterator[T]) -> list[T] | None:
    """Advance a blocking iterator in a worker thread. ``None`` when exhausted."""
    sentinel = object()
    item = await asyncio.to_thread(next, iterator, sentinel)
    return None if item is sentinel else item


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

FUND_COLUMNS = ('ID_Registro_Fundo', 'CNPJ_Fundo', 'Tipo_Fundo', 'Denominacao_Social', 'Situacao')
CLASS_COLUMNS = ('ID_Registro_Fundo', 'ID_Registro_Classe', 'CNPJ_Classe', 'Denominacao_Social')
SUBCLASS_COLUMNS = ('ID_Registro_Classe', 'ID_Subclasse', 'Denominacao_Social')
TERMS_COLUMNS = ('CNPJ_FUNDO_CLASSE', 'DT_COMPTC', 'TAXA_ADM', 'APLIC_MIN')


def _fund_row(row: dict[str, str], now: datetime) -> dict:
    return {
        'registry_id': int(row['ID_Registro_Fundo']),
        'cnpj': digits(row['CNPJ_Fundo']),
        'name': _text(row['Denominacao_Social'], 300) or '',
        'kind': _text(row['Tipo_Fundo'], 20) or '',
        'status': _text(row['Situacao'], 60) or '',
        'started_at': _date(row.get('Data_Registro')) or _date(row.get('Data_Constituicao')),
        'cancelled_at': _date(row.get('Data_Cancelamento')),
        'administrator_name': _text(row.get('Administrador'), 150),
        'administrator_cnpj': _text(digits(row.get('CNPJ_Administrador')), 14),
        'manager_name': _text(row.get('Gestor')),
        'manager_document': _text(digits(row.get('CPF_CNPJ_Gestor'))),
        'refreshed_at': now,
    }


def _merge_manager(merged: dict, row: dict) -> None:
    for column in ('manager_name', 'manager_document'):
        value = row[column]
        present = (merged[column] or '').split(' / ')
        if value and value not in present:
            merged[column] = f'{merged[column]} / {value}' if merged[column] else value


def iter_fund_batches(path: Path, *, now: datetime | None = None) -> Iterator[list[dict]]:
    now = now or datetime.now(UTC)
    seen: set[int] = set()

    def merged_rows() -> Iterator[dict]:
        current: dict | None = None
        for member, raw in iter_csv_rows(path, members=lambda name: name == REGISTRY_FUND_MEMBER):
            if current is None:
                _require(member, raw, FUND_COLUMNS)
            row = _fund_row(raw, now)
            if current is not None and row['registry_id'] == current['registry_id']:
                _merge_manager(current, row)
                continue
            if row['registry_id'] in seen:
                raise IntegrationBadResponse(
                    f'CVM registry repeats fund {row["registry_id"]} out of order',
                    provider=PROVIDER,
                )
            if current is not None:
                yield current
            seen.add(row['registry_id'])
            current = row
        if current is not None:
            yield current

    for batch in _batches(merged_rows(), REGISTRY_BATCH_SIZE):
        for row in batch:
            row['manager_name'] = _text(row['manager_name'], 500)
            row['manager_document'] = _text(row['manager_document'], 120)
        yield batch


def iter_class_batches(
    path: Path,
    fund_ids: dict[int, int],
    *,
    now: datetime | None = None,
) -> Iterator[list[dict]]:
    """Classes keyed to the stored fund. A class whose fund is not stored fails
    the file: funds are written first, so that cannot be an ordering accident."""
    now = now or datetime.now(UTC)
    seen: set[int] = set()

    def rows() -> Iterator[dict]:
        for index, (member, raw) in enumerate(
            iter_csv_rows(path, members=lambda name: name == REGISTRY_CLASS_MEMBER)
        ):
            if index == 0:
                _require(member, raw, CLASS_COLUMNS)
            registry_id = int(raw['ID_Registro_Classe'])
            if registry_id in seen:
                continue
            seen.add(registry_id)
            fund_registry_id = int(raw['ID_Registro_Fundo'])
            if fund_registry_id not in fund_ids:
                raise IntegrationBadResponse(
                    f'CVM registry class {registry_id} names unknown fund {fund_registry_id}',
                    provider=PROVIDER,
                )
            yield {
                'registry_id': registry_id,
                'fund_registry_id': fund_ids[fund_registry_id],
                'cnpj': digits(raw['CNPJ_Classe']),
                'name': _text(raw['Denominacao_Social'], 300) or '',
                'class_type': _text(raw.get('Tipo_Classe'), 80),
                'status': _text(raw.get('Situacao'), 60),
                'classification': _text(raw.get('Classificacao'), 80),
                'anbima_classification': _text(raw.get('Classificacao_Anbima'), 120),
                'open_ended': _open_ended(raw.get('Forma_Condominio')),
                'exclusive': _yes_no(raw.get('Exclusivo')),
                'target_investors': _text(raw.get('Publico_Alvo'), 60),
                # 'N/A' is the registry saying the regime does not apply.
                'long_term_taxation': _yes_no(raw.get('Tributacao_Longo_Prazo')),
                'custodian_name': _text(raw.get('Custodiante'), 150),
                'auditor_name': _text(raw.get('Auditor'), 150),
                'equity': _decimal(raw.get('Patrimonio_Liquido')),
                'equity_date': _date(raw.get('Data_Patrimonio_Liquido')),
                'refreshed_at': now,
            }

    yield from _batches(rows(), REGISTRY_BATCH_SIZE)


def iter_subclass_batches(
    path: Path,
    class_ids: dict[int, int],
    *,
    now: datetime | None = None,
) -> Iterator[list[dict]]:
    now = now or datetime.now(UTC)

    def rows() -> Iterator[dict]:
        for index, (member, raw) in enumerate(
            iter_csv_rows(path, members=lambda name: name == REGISTRY_SUBCLASS_MEMBER)
        ):
            if index == 0:
                _require(member, raw, SUBCLASS_COLUMNS)
            class_registry_id = int(raw['ID_Registro_Classe'])
            if class_registry_id not in class_ids:
                raise IntegrationBadResponse(
                    f'CVM registry subclass names unknown class {class_registry_id}',
                    provider=PROVIDER,
                )
            yield {
                'fund_registry_class_id': class_ids[class_registry_id],
                'code': _text(raw['ID_Subclasse'], 30) or '',
                'name': _text(raw['Denominacao_Social'], 300) or '',
                'status': _text(raw.get('Situacao'), 60),
                'target_investors': _text(raw.get('Publico_Alvo'), 60),
                'pension': _yes_no(raw.get('Previdenciario')),
                'refreshed_at': now,
            }

    yield from _batches(rows(), REGISTRY_BATCH_SIZE)


def iter_terms_batches(path: Path) -> Iterator[list[dict]]:
    """Terms per CNPJ. The file holds one current row per CNPJ; should it ever
    hold several, the latest competence date wins within the batch window."""

    def rows() -> Iterator[dict]:
        for index, (member, raw) in enumerate(iter_csv_rows(path)):
            if index == 0:
                _require(member, raw, TERMS_COLUMNS)
            yield {
                'cnpj': digits(raw['CNPJ_FUNDO_CLASSE']),
                'admin_fee': _decimal(raw.get('TAXA_ADM')),
                'performance_fee': _decimal(raw.get('TAXA_PERFM')),
                'performance_benchmark': _text(raw.get('PARAM_TAXA_PERFM'), 100),
                'minimum_investment': _decimal(raw.get('APLIC_MIN')),
                'conversion_days': _int(raw.get('QT_DIA_CONVERSAO_COTA')),
                'redemption_payment_days': _int(raw.get('QT_DIA_PAGTO_RESGATE')),
                'terms_date': _date(raw['DT_COMPTC']),
            }

    for batch in _batches(rows(), REGISTRY_BATCH_SIZE):
        latest: dict[str, dict] = {}
        for row in batch:
            kept = latest.get(row['cnpj'])
            if kept is None or (row['terms_date'] or date.min) >= (kept['terms_date'] or date.min):
                latest[row['cnpj']] = row
        yield list(latest.values())


# ---------------------------------------------------------------------------
# Share-value filings
# ---------------------------------------------------------------------------

DAILY_CNPJ_COLUMNS = ('CNPJ_FUNDO_CLASSE', 'CNPJ_FUNDO')
DAILY_COLUMNS = ('DT_COMPTC', 'VL_QUOTA')
FIDC_COLUMNS = ('DT_COMPTC', 'TAB_X_CLASSE_SERIE', 'TAB_X_QT_COTA', 'TAB_X_VL_COTA')

MEMBER_FILTERS: dict[ShareValueDataset, Callable[[str], bool]] = {
    ShareValueDataset.DAILY: daily_share_value_member,
    ShareValueDataset.FIDC_MONTHLY: fidc_share_value_member,
}


@dataclass
class FilingScan:
    """The filings of the requested CNPJs in one file, and how much was read."""

    rows_read: int = 0
    filings: dict[str, list[ShareValueFiling]] = field(default_factory=dict)


def _cnpj_column(member: str, row: dict[str, str]) -> str:
    for column in DAILY_CNPJ_COLUMNS:
        if column in row:
            return column
    raise IntegrationBadResponse(f'CVM file member {member} has no CNPJ column', provider=PROVIDER)


def _filing_decimal(member: str, row: dict[str, str], column: str) -> Decimal | None:
    raw = (row.get(column) or '').strip()
    value = _decimal(raw)
    if raw and (value is None or not value.is_finite()):
        raise IntegrationBadResponse(
            f'CVM file member {member} has an invalid {column}', provider=PROVIDER
        )
    return value


def scan_share_value_filings(
    path: Path,
    dataset: ShareValueDataset,
    cnpjs: set[str],
) -> FilingScan:
    """Keep the filings of ``cnpjs``: a set lookup per line, nothing else parsed.

    Blocking; run it in a thread. A ~530k-line monthly file takes seconds.
    """
    scan = FilingScan()
    checked_members: dict[str, str] = {}
    required = DAILY_COLUMNS if dataset == ShareValueDataset.DAILY else FIDC_COLUMNS

    def validate_header(member: str, columns: list[str]) -> None:
        header = dict.fromkeys(columns, '')
        checked_members[member] = _cnpj_column(member, header)
        _require(member, header, required)

    for member, row in iter_csv_rows(
        path, members=MEMBER_FILTERS[dataset], validate_header=validate_header
    ):
        cnpj_column = checked_members[member]
        scan.rows_read += 1
        raw_cnpj = row[cnpj_column]
        cnpj = raw_cnpj.replace('.', '').replace('/', '').replace('-', '').strip()
        if cnpj not in cnpjs:
            continue
        if dataset == ShareValueDataset.DAILY:
            filing = ShareValueFiling(
                cnpj=cnpj,
                subclass_code=_text(row.get('ID_SUBCLASSE')),
                date=date.fromisoformat(row['DT_COMPTC']),
                label=None,
                shares=None,
                share_value=_filing_decimal(member, row, 'VL_QUOTA'),
            )
        else:
            filing = ShareValueFiling(
                cnpj=cnpj,
                subclass_code=None,
                date=date.fromisoformat(row['DT_COMPTC']),
                label=_text(row['TAB_X_CLASSE_SERIE']) or '',
                shares=_filing_decimal(member, row, 'TAB_X_QT_COTA'),
                share_value=_filing_decimal(member, row, 'TAB_X_VL_COTA'),
            )
        scan.filings.setdefault(cnpj, []).append(filing)
    return scan


def _published(dataset: ShareValueDataset, files: list[CvmFile]) -> list[PublishedFile]:
    return [
        PublishedFile(
            dataset=dataset,
            period=file.period,
            path=file.path,
            first_day=file.first_day,
            last_day=file.last_day,
        )
        for file in files
    ]


async def list_published_files(
    client: CvmClient, dataset: ShareValueDataset
) -> list[PublishedFile]:
    """Every file the source currently lists for a dataset, oldest first."""
    if dataset == ShareValueDataset.DAILY:
        return _published(dataset, await client.list_daily_share_value_files())
    return _published(dataset, await client.list_fidc_monthly_files())
