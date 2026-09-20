"""Share values of registered funds, from the regulator's files into quote history.

The data is per file and one file serves every fund in it, so the run works in
that shape: plan which files each fund needs, then read each file once for all
the funds that need it. Nothing is kept on disk after a file is applied.

What makes a file skippable is coverage, never a validator alone: a ``304``
says the body did not change, not that this fund, with this selection, from
this purchase date, was ever applied from it.
"""

import asyncio
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.config.logger import logger
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.integrations.cvm_client import PROVIDER, CvmClient, DownloadedFile, NotModified
from app.modules.market_data.adapters.fund_filings import (
    FilingScan,
    list_published_files,
    scan_share_value_filings,
)
from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY
from app.modules.market_data.domain.fund_registry import FundShareSeriesAlias
from app.modules.market_data.domain.fund_share_value import (
    FileNeed,
    FileReason,
    FundShareValueCoverage,
    IngestionMode,
    PublishedFile,
    ShareValue,
    ShareValueDataset,
    ShareValueSelectionError,
    SourceFile,
    UnitState,
    UnsupportedFundKind,
    file_containing,
    forward_needs,
    is_covered,
    need_from,
    pending_months,
    previous_files,
    seed_is_proven,
    select_share_values,
    share_value_dataset,
    split_for_purchase,
)
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.market_data.service.data_ingestion_service import DataIngestionService

SOURCE = PROVIDER
REVISION_CHECKPOINT = 'fund_share_value_revision'
LOCAL_TIMEZONE = ZoneInfo('America/Sao_Paulo')
REVISION_WEEKDAY = 1  # Tuesday
FUND_ASSET_TYPES = {ASSET_TYPE.FI, ASSET_TYPE.PREV}
QUOTE_DECIMALS = Decimal('0.00000001')


class ShareValueIngestionAborted(Exception):
    pass


@dataclass
class _Unit:
    asset_id: int
    label: str
    cnpj: str
    subclass_code: str | None
    series_id: int | None
    aliases: list[FundShareSeriesAlias]
    state: UnitState
    mode: IngestionMode = IngestionMode.ROUTINE
    seed_found: bool = False
    files: list[str] = field(default_factory=list)
    matched_rows: int = 0
    quotes_written: int = 0
    changed_from: date | None = None
    errors: list[str] = field(default_factory=list)


@dataclass
class FundShareValueRun:
    execution_id: int | None
    #: Assets whose stored share values changed, with the earliest changed date.
    changed: dict[int, date] = field(default_factory=dict)
    #: Only completed, error-free units may be consolidated after this run.
    succeeded: set[int] = field(default_factory=set)
    errors: dict[int, str] = field(default_factory=dict)


def revision_due(last_success: datetime | None, now: datetime) -> bool:
    """Due once per week from Tuesday on; a missed or failed sweep stays due."""
    local_now = now.astimezone(LOCAL_TIMEZONE)
    days_since_tuesday = (local_now.weekday() - REVISION_WEEKDAY) % 7
    week_start = (local_now - timedelta(days=days_since_tuesday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return last_success is None or last_success < week_start


def revision_checkpoint(state: UnitState) -> str:
    """A revision vouches only for this asset, selection and purchase boundary."""
    return f'{REVISION_CHECKPOINT}:{state.asset_id}:{state.selection_version}:{state.since:%Y%m%d}'


class FundShareValueIngestionService:
    def __init__(
        self,
        *,
        uow_factory: Callable[[], UnitOfWork],
        ingestion_service: DataIngestionService,
        client: CvmClient,
    ):
        self.uow_factory = uow_factory
        self.ingestion_service = ingestion_service
        self.client = client

    async def run(  # noqa: PLR0913
        self,
        *,
        fund_asset_ids_since: dict[int, date],
        without_purchase: Sequence[int] = (),
        execution_id: int | None = None,
        force_full_history: bool = False,
        selection_parameters: dict | None = None,
        now: datetime | None = None,
    ) -> FundShareValueRun:
        item_ids = sorted({*fund_asset_ids_since, *without_purchase})
        prepared = await self.ingestion_service.prepare_execution(
            ingestion_type=DataIngestionType.FUND_SHARE_VALUE,
            execution_id=execution_id,
            force_full_history=force_full_history,
            scheduled_item_ids=item_ids,
        )
        if prepared is None:
            return FundShareValueRun(execution_id=execution_id)
        current_execution_id, force_full_history, _ = prepared
        now = now or datetime.now(UTC)
        today = now.astimezone(LOCAL_TIMEZONE).date()
        run = FundShareValueRun(execution_id=current_execution_id)
        try:
            units, rejected = await self._load_units(fund_asset_ids_since, without_purchase)
            async with self.uow_factory() as uow:
                checkpoints = await uow.source_files.get_checkpoints([
                    revision_checkpoint(unit.state) for unit in units
                ])
            for unit in units:
                checkpoint = checkpoints.get(revision_checkpoint(unit.state))
                unit.mode = (
                    IngestionMode.FORCE
                    if force_full_history
                    else IngestionMode.REVISION
                    if revision_due(checkpoint.succeeded_at if checkpoint else None, now)
                    else IngestionMode.ROUTINE
                )
            mode = (
                IngestionMode.FORCE
                if force_full_history
                else IngestionMode.REVISION
                if any(unit.mode == IngestionMode.REVISION for unit in units)
                else IngestionMode.ROUTINE
            )
            file_log: list[dict] = []
            parameters = {
                **(selection_parameters or {}),
                'item_ids': item_ids,
                'mode': mode.value,
                'force_full_history': force_full_history,
                'files': file_log,
            }
            await self.ingestion_service.set_execution_items(
                current_execution_id, item_ids=item_ids, parameters=parameters
            )

            attempts: dict[int, int] = {}
            for asset_id, (label, error) in rejected.items():
                attempt_id = await self._start_attempt(current_execution_id, asset_id, label)
                await self.ingestion_service.finish_attempt(
                    current_execution_id,
                    attempt_id,
                    status='failure',
                    parameters={'reason': error},
                    error=error,
                )
            for unit in units:
                attempts[unit.asset_id] = await self._start_attempt(
                    current_execution_id, unit.asset_id, unit.label
                )

            aborted = False
            try:
                for dataset in ShareValueDataset:
                    dataset_units = [unit for unit in units if unit.state.dataset == dataset]
                    if dataset_units:
                        await self._ingest_dataset(
                            current_execution_id,
                            dataset,
                            dataset_units,
                            mode=mode,
                            today=today,
                            file_log=file_log,
                            parameters=parameters,
                        )
            except ShareValueIngestionAborted:
                aborted = True

            run.changed.update({
                unit.asset_id: unit.changed_from for unit in units if unit.changed_from
            })
            run.errors.update({asset_id: error for asset_id, (_, error) in rejected.items()})
            run.errors.update({
                unit.asset_id: '; '.join(unit.errors) for unit in units if unit.errors
            })
            if aborted:
                return run

            await self._finish_attempts(current_execution_id, units, attempts)
            async with self.uow_factory() as uow:
                for unit in units:
                    if (
                        unit.mode in (IngestionMode.REVISION, IngestionMode.FORCE)
                        and not unit.errors
                    ):
                        await uow.source_files.save_checkpoint(revision_checkpoint(unit.state), now)
                await uow.commit()
            await self.ingestion_service.finish(current_execution_id)
            run.succeeded.update(unit.asset_id for unit in units if not unit.errors)
            return run
        except Exception as exc:
            logger.exception('Fund share-value ingestion failed')
            await self.ingestion_service.fail(current_execution_id, exc)
            raise

    async def _finish_attempts(
        self, execution_id: int, units: list[_Unit], attempts: dict[int, int]
    ) -> None:
        for unit in units:
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempts[unit.asset_id],
                status='failure' if unit.errors else 'success',
                parameters={
                    'since': unit.state.since.isoformat(),
                    'dataset': unit.state.dataset.value,
                    'mode': unit.mode.value,
                    'files': unit.files,
                    'seed_date': unit.state.seed_date.isoformat() if unit.state.seed_date else None,
                    'changed_from': unit.changed_from.isoformat() if unit.changed_from else None,
                },
                fetched_rows=unit.matched_rows,
                upserted_rows=unit.quotes_written,
                error='; '.join(unit.errors) or None,
            )

    async def _start_attempt(self, execution_id: int, asset_id: int, label: str) -> int:
        return await self.ingestion_service.start_attempt(
            execution_id,
            item_id=asset_id,
            item_label=label[:100],
            source=SOURCE,
            parameters={},
        )

    async def _load_units(
        self,
        since_by_asset: dict[int, date],
        without_purchase: Sequence[int],
    ) -> tuple[list[_Unit], dict[int, tuple[str, str]]]:
        rejected: dict[int, tuple[str, str]] = {}
        units: list[_Unit] = []
        asset_ids = sorted({*since_by_asset, *without_purchase})
        async with self.uow_factory() as uow:
            funds = {fund.asset_id: fund for fund in await uow.fund_registry.get_funds(asset_ids)}
            class_ids = [
                f.fund_registry_class_id for f in funds.values() if f.fund_registry_class_id
            ]
            aliases = await uow.fund_registry.list_aliases(class_ids)
            unlinked_cnpjs = [
                (fund.legal_id or '').strip()
                for fund in funds.values()
                if fund.fund_registry_class_id is None and fund.legal_id
            ]
            classes_by_cnpj: dict[str, list] = {}
            for registry_class in await uow.fund_registry.find_classes_by_cnpj([
                ''.join(char for char in cnpj if char.isdigit()) for cnpj in unlinked_cnpjs
            ]):
                classes_by_cnpj.setdefault(registry_class.cnpj, []).append(registry_class)
            latest = await uow.quotes.get_latest_quote_dates(list(since_by_asset))
            coverage = await uow.source_files.get_coverage(asset_ids=list(since_by_asset))
            seeds = {}
            for asset_id, since in since_by_asset.items():
                seed = await uow.quotes.get_latest_quote_on_or_before(asset_id, since)
                seeds[asset_id] = seed.date if seed else None

        for asset_id in asset_ids:
            fund = funds.get(asset_id)
            label = (fund.asset.name if fund and fund.asset else None) or f'Ativo {asset_id}'
            if asset_id not in since_by_asset:
                rejected[asset_id] = (label, 'No purchase recorded for this fund')
                continue
            if (
                fund is None
                or fund.asset is None
                or fund.asset.asset_type_id not in FUND_ASSET_TYPES
            ):
                rejected[asset_id] = (label, 'Not an investment or pension fund')
                continue
            registry_class = fund.registry_class
            if registry_class is None:
                digits = ''.join(char for char in (fund.legal_id or '') if char.isdigit())
                matches = classes_by_cnpj.get(digits, [])
                if len(matches) != 1:
                    rejected[asset_id] = (
                        label,
                        'The fund is not linked to the registry and its CNPJ '
                        + ('matches no registered class' if not matches else 'matches several'),
                    )
                    continue
                registry_class = matches[0]
            legal_id = ''.join(char for char in (fund.legal_id or '') if char.isdigit())
            if legal_id and legal_id != registry_class.cnpj:
                rejected[asset_id] = (
                    label,
                    'The linked registry class CNPJ differs from the fund CNPJ; '
                    'correct the registry link before ingestion',
                )
                continue
            try:
                dataset = share_value_dataset(
                    registry_class.fund.kind if registry_class.fund else None
                )
            except UnsupportedFundKind as exc:
                rejected[asset_id] = (label, str(exc))
                continue
            if dataset == ShareValueDataset.FIDC_MONTHLY and fund.fund_share_series_id is None:
                rejected[asset_id] = (
                    label,
                    'Choose and confirm the series of this fund before ingestion',
                )
                continue
            units.append(
                _Unit(
                    asset_id=asset_id,
                    label=label,
                    cnpj=registry_class.cnpj,
                    subclass_code=fund.registry_subclass.code if fund.registry_subclass else None,
                    series_id=fund.fund_share_series_id,
                    aliases=[
                        alias
                        for alias in aliases
                        if alias.fund_registry_class_id == registry_class.id
                    ],
                    state=UnitState(
                        asset_id=asset_id,
                        dataset=dataset,
                        since=since_by_asset[asset_id],
                        selection_version=fund.selection_version,
                        latest_quote_date=latest.get(asset_id),
                        seed_date=seeds.get(asset_id),
                        coverage=[c for c in coverage if c.asset_id == asset_id],
                    ),
                )
            )
        return units, rejected

    async def _ingest_dataset(  # noqa: PLR0913
        self,
        execution_id: int,
        dataset: ShareValueDataset,
        units: list[_Unit],
        *,
        mode: IngestionMode,
        today: date,
        file_log: list[dict],
        parameters: dict,
    ) -> bool:
        """Apply every file the units need. Returns whether a source file failed."""
        try:
            files = await list_published_files(self.client, dataset)
        except Exception as exc:
            logger.exception('Listing %s failed', dataset.value)
            file_log.append({'dataset': dataset.value, 'status': 'failed', 'error': str(exc)})
            for unit in units:
                unit.errors.append(f'Could not list {dataset.value} files: {exc}')
            await self._log(execution_id, parameters)
            return True

        async with self.uow_factory() as uow:
            known = await uow.source_files.get_files([file.key for file in files])
        for unit in units:
            unit.state.known_files = known
            unit.seed_found = mode != IngestionMode.FORCE and seed_is_proven(unit.state, files)

        by_asset = {unit.asset_id: unit for unit in units}
        failed = False
        pending = sorted({
            month for unit in units for month in pending_months(files, unit.state.since, today)
        })
        for month in pending:
            file_log.append({
                'dataset': dataset.value,
                'period': month,
                'status': 'pending_publication',
            })

        needs: dict[tuple[str, str], list[FileNeed]] = {}
        for unit in units:
            for need in forward_needs(unit.state, files, today=today, mode=unit.mode):
                needs.setdefault(need.file.key, []).append(need)
        for file in files:
            if file.key in needs:
                failed |= await self._apply_file(
                    execution_id, file, needs[file.key], by_asset, mode, file_log, parameters
                )

        failed |= await self._search_seeds(
            execution_id, files, units, by_asset, mode, file_log, parameters
        )
        return failed

    async def _search_seeds(  # noqa: PLR0913
        self,
        execution_id: int,
        files: list[PublishedFile],
        units: list[_Unit],
        by_asset: dict[int, _Unit],
        mode: IngestionMode,
        file_log: list[dict],
        parameters: dict,
    ) -> bool:
        """Walk back one file at a time until each fund has a value on or before
        its purchase, batching funds that are at the same file.

        The walk ends at the earliest file the source lists. A file this fund
        already applied in its current version is not read again: the seed it
        held, if any, is the one already stored.
        """
        failed = False
        cursors = {
            unit.asset_id: previous_files(
                files, _first_day_of_purchase_file(files, unit.state.since)
            )
            for unit in units
            if not unit.seed_found and not unit.errors
        }
        while cursors:
            round_needs: dict[tuple[str, str], list[FileNeed]] = {}
            for asset_id, path in list(cursors.items()):
                unit = by_asset[asset_id]
                while path:
                    file = path[0]
                    if mode != IngestionMode.FORCE and is_covered(unit.state, file):
                        path.pop(0)
                        seed = unit.state.seed_date
                        if seed is not None and file.first_day <= seed <= file.last_day:
                            unit.seed_found = True
                            break
                        continue
                    round_needs.setdefault(file.key, []).append(
                        FileNeed(asset_id, file, FileReason.SEED, covered=False)
                    )
                    break
                if unit.seed_found:
                    del cursors[asset_id]
                elif not path:
                    unit.errors.append(
                        f'missing_seed: no share value on or before the purchase on '
                        f'{unit.state.since:%Y-%m-%d}, searched from '
                        f'{files[0].first_day:%Y-%m-%d} to {unit.state.since:%Y-%m-%d}'
                    )
                    del cursors[asset_id]
            if not round_needs:
                break
            for key, file_needs in sorted(round_needs.items(), reverse=True):
                file = file_needs[0].file
                failed |= await self._apply_file(
                    execution_id, file, file_needs, by_asset, mode, file_log, parameters
                )
                for need in file_needs:
                    unit = by_asset[need.asset_id]
                    path = cursors.get(need.asset_id)
                    if path and path[0].key == key:
                        path.pop(0)
                    if unit.seed_found or unit.errors:
                        cursors.pop(need.asset_id, None)
        return failed

    async def _apply_file(  # noqa: PLR0913
        self,
        execution_id: int,
        file: PublishedFile,
        needs: list[FileNeed],
        by_asset: dict[int, _Unit],
        mode: IngestionMode,
        file_log: list[dict],
        parameters: dict,
    ) -> bool:
        if await self.ingestion_service.is_aborted(execution_id):
            raise ShareValueIngestionAborted
        units = [by_asset[need.asset_id] for need in needs]
        entry = {
            'dataset': file.dataset.value,
            'period': file.period,
            'reasons': sorted({need.reason.value for need in needs}),
            'asset_ids': [unit.asset_id for unit in units],
        }
        file_log.append(entry)
        for unit in units:
            unit.files.append(file.period)
        known = units[0].state.known_files.get(file.key)
        conditional = mode != IngestionMode.FORCE and all(need.covered for need in needs)
        source_failed = False
        try:
            async with self.client.download(
                file.path,
                etag=known.etag if conditional and known else None,
                last_modified=known.last_modified if conditional and known else None,
            ) as result:
                if isinstance(result, NotModified):
                    entry['status'] = 'not_modified'
                    return False
                if not isinstance(result, DownloadedFile):
                    raise FileNotFoundError(f'{file.path} is listed but not published')
                entry.update(status='downloaded', size_bytes=result.size_bytes)
                scan: FilingScan = await asyncio.to_thread(
                    scan_share_value_filings,
                    result.path,
                    file.dataset,
                    {unit.cnpj for unit in units},
                )
                matched = 0
                for need, unit in zip(needs, units, strict=True):
                    if await self.ingestion_service.is_aborted(execution_id):
                        raise ShareValueIngestionAborted
                    matched += await self._apply_to_unit(unit, file, result, scan, need)
                entry['matched_rows'] = matched
                async with self.uow_factory() as uow:
                    source_file_id = await uow.source_files.save_version(
                        dataset=file.dataset.value,
                        period=file.period,
                        etag=result.etag,
                        last_modified=result.last_modified,
                        size_bytes=result.size_bytes,
                        content_version=result.content_version,
                        fetched_at=datetime.now(UTC),
                    )
                    await uow.commit()
                saved = await self._known_file(file, source_file_id, result)
                for unit in units:
                    unit.state.known_files = {**unit.state.known_files, file.key: saved}
        except ShareValueIngestionAborted:
            raise
        except Exception as exc:
            logger.exception('Share-value file %s failed', file.path)
            entry.update(status='failed', error=str(exc) or exc.__class__.__name__)
            for unit in units:
                unit.errors.append(f'{file.dataset.value} {file.period}: {entry["error"]}')
            source_failed = True
        finally:
            await self._log(execution_id, parameters)
        return source_failed

    async def _apply_to_unit(
        self,
        unit: _Unit,
        file: PublishedFile,
        downloaded: DownloadedFile,
        scan: FilingScan,
        need: FileNeed,
    ) -> int:
        """Write one fund's values and coverage for one file, in one transaction."""
        filings = scan.filings.get(unit.cnpj, [])
        try:
            values = select_share_values(
                filings,
                subclass_code=unit.subclass_code,
                series_id=unit.series_id,
                aliases=unit.aliases,
            )
        except ShareValueSelectionError as exc:
            unit.errors.append(f'{file.period}: {exc}')
            return len(filings)
        since = unit.state.since
        kept, seed = split_for_purchase(values, since)
        to_write = [*([seed] if seed else []), *kept]
        async with self.uow_factory() as uow:
            changed_from = await self._reconcile_quotes(uow, unit.asset_id, file, to_write)
            await uow.quotes.upsert_quotes([
                {
                    'asset_id': unit.asset_id,
                    'date': value.date,
                    'close': value.value,
                    'adjusted_close': value.value,
                    'currency_id': CURRENCY.BRL,
                    'source': SOURCE,
                }
                for value in to_write
            ])
            source_file_id = await uow.source_files.ensure_file(
                dataset=file.dataset.value, period=file.period
            )
            coverage = FundShareValueCoverage(
                source_file_id=source_file_id,
                asset_id=unit.asset_id,
                content_version=downloaded.content_version,
                selection_version=unit.state.selection_version,
                covered_from=need_from(file, since),
                covered_to=file.last_day,
                matched_rows=len(values),
            )
            await uow.source_files.add_coverage(coverage)
            current_seed = await uow.quotes.get_latest_quote_on_or_before(unit.asset_id, since)
            await uow.commit()
        unit.state.coverage = [*unit.state.coverage, coverage]
        unit.matched_rows += len(filings)
        unit.quotes_written += len(to_write)
        if changed_from is not None:
            unit.changed_from = min(unit.changed_from or changed_from, changed_from)
        previous_seed = unit.state.seed_date
        unit.state.seed_date = current_seed.date if current_seed else None
        if seed is not None or any(value.date == since for value in kept):
            unit.seed_found = True
        elif previous_seed is not None and file.first_day <= previous_seed <= file.last_day:
            # A retification withdrew the seed. Walk backwards again; a stale
            # seed must not survive simply because it was proven before this run.
            unit.seed_found = False
        return len(filings)

    @staticmethod
    async def _reconcile_quotes(
        uow, asset_id: int, file: PublishedFile, values: list[ShareValue]
    ) -> date | None:
        """Reconcile the source's snapshot, including withdrawals and moved dates.

        Only quotes from this source within this file's period may be removed.
        Coverage and the replacement values commit in the caller's transaction.
        """
        stored = {
            quote.date: quote.close
            for quote in await uow.quotes.get_source_quotes(
                asset_id, source=SOURCE, start_date=file.first_day, end_date=file.last_day
            )
        }
        removed = set(stored) - {value.date for value in values}
        await uow.quotes.delete_source_quotes(asset_id, source=SOURCE, dates=removed)
        changed = [
            value.date
            for value in values
            if stored.get(value.date) is None
            or Decimal(stored[value.date]).quantize(QUOTE_DECIMALS)
            != value.value.quantize(QUOTE_DECIMALS)
        ]
        return min([*changed, *removed]) if changed or removed else None

    @staticmethod
    async def _known_file(file: PublishedFile, source_file_id: int, result: DownloadedFile):
        return SourceFile(
            id=source_file_id,
            dataset=file.dataset.value,
            period=file.period,
            etag=result.etag,
            last_modified=result.last_modified,
            size_bytes=result.size_bytes,
            content_version=result.content_version,
        )

    async def _log(self, execution_id: int, parameters: dict) -> None:
        await self.ingestion_service.set_parameters(execution_id, parameters)

    async def aclose(self) -> None:
        await self.client.close()


def _first_day_of_purchase_file(files: Sequence[PublishedFile], since: date) -> date:
    """Where the seed search starts: before the file holding the purchase date,
    or before the purchase itself when that month is not published yet."""
    containing = file_containing(files, since)
    return containing.first_day if containing else since
