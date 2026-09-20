"""Share-value filings, the files that carry them, and what was applied from them.

A file serves every fund in it, so ingestion is planned file first: which files
a set of priced units needs, and which of those were already applied to each
unit in their current version. Nothing here knows where the files live.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from enum import StrEnum

from app.modules.market_data.domain.fund_registry import (
    FundShareSeriesAlias,
    normalize_series_label,
)


class ShareValueDataset(StrEnum):
    #: Classes that file a share value every business day (FIF, pension).
    DAILY = 'daily_share_value'
    #: FIDC classes, which file one value per series at the end of each month.
    FIDC_MONTHLY = 'fidc_monthly'


class RegistryDataset(StrEnum):
    FUND_REGISTRY = 'fund_registry'
    FUND_TERMS = 'fund_terms'


@dataclass(eq=False, kw_only=True)
class SourceFile:
    """The last version of a published file that was fully processed.

    Validators describe the body; they say nothing about which units were
    applied from it. That is ``FundShareValueCoverage``.
    """

    id: int | None = None
    dataset: str
    period: str
    etag: str | None = None
    last_modified: datetime | None = None
    size_bytes: int | None = None
    content_version: str | None = None
    #: Registry version to which this terms file was applied.
    applied_registry_version: str | None = None
    fetched_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class FundShareValueCoverage:
    """One file version successfully applied to one asset.

    Every value of the asset dated in ``[covered_from, covered_to]`` present in
    that version is persisted, and so is the latest one dated before
    ``covered_from`` within the file — that one is a seed candidate. When the
    purchase is after the file, ``covered_from > covered_to``: only the seed
    candidate was needed from it. Zero matched rows is still coverage.
    """

    id: int | None = None
    source_file_id: int
    asset_id: int
    content_version: str
    selection_version: int
    covered_from: date
    covered_to: date
    matched_rows: int = 0
    processed_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class IngestionCheckpoint:
    """When a recurring piece of work last completed.

    Execution history is kept for two days, so a weekly obligation cannot be
    read back from it.
    """

    name: str
    succeeded_at: datetime


# ---------------------------------------------------------------------------
# Which dataset a fund files in
# ---------------------------------------------------------------------------

#: Registry fund kinds whose classes file a daily share value.
DAILY_FUND_KINDS = frozenset({'FI', 'FIF', 'FACFIF', 'FAPI'})
FIDC_FUND_KINDS = frozenset({'FIDC'})


class UnsupportedFundKind(ValueError):
    """A fund whose share value this ingestion does not read (FII, FIP, ...)."""


def share_value_dataset(kind: str | None) -> ShareValueDataset:
    if kind in DAILY_FUND_KINDS:
        return ShareValueDataset.DAILY
    if kind in FIDC_FUND_KINDS:
        return ShareValueDataset.FIDC_MONTHLY
    raise UnsupportedFundKind(
        f'Funds of kind {kind or "unknown"} do not file a share value that is ingested'
    )


# ---------------------------------------------------------------------------
# From filings to share values
# ---------------------------------------------------------------------------

#: ``market_data.quote.close`` is NUMERIC(18, 8): anything from here up cannot
#: be stored, and in the files it only appears in obviously broken old filings.
MAX_SHARE_VALUE = Decimal('1e10')


@dataclass(frozen=True)
class ShareValueFiling:
    """One row of a share-value file, for one class and date.

    Daily filings name a subclass and no series; FIDC filings name a series
    label, outstanding shares and no subclass.
    """

    cnpj: str
    date: date
    share_value: Decimal | None
    subclass_code: str | None = None
    label: str | None = None
    shares: Decimal | None = None


@dataclass(frozen=True)
class ShareValue:
    date: date
    value: Decimal
    label: str | None = None


class ShareValueSelectionError(ValueError):
    """The filings do not identify one price for the unit. Fails that fund only."""


class AmbiguousShareClass(ShareValueSelectionError):
    pass


class MissingShareSeries(ShareValueSelectionError):
    pass


class UnknownShareSeriesLabel(ShareValueSelectionError):
    pass


class ConflictingShareValueFiling(ShareValueSelectionError):
    pass


class ShareValueOutOfRange(ShareValueSelectionError):
    pass


def _is_price(value: Decimal | None) -> bool:
    return value is not None and value > 0


def _checked(filing: ShareValueFiling) -> ShareValue:
    if filing.share_value >= MAX_SHARE_VALUE:
        raise ShareValueOutOfRange(
            f'Share value {filing.share_value} filed on {filing.date:%Y-%m-%d} cannot be a price'
        )
    return ShareValue(date=filing.date, value=filing.share_value, label=filing.label)


def _one_per_key(rows: Iterable[ShareValueFiling], key) -> dict:
    """Collapse identical repeats; disagreeing repeats are a conflict."""
    kept: dict = {}
    for row in rows:
        existing = kept.get(key(row))
        if existing is None:
            kept[key(row)] = row
        elif (existing.share_value, existing.shares) != (row.share_value, row.shares):
            raise ConflictingShareValueFiling(
                f'Two different share values filed on {row.date:%Y-%m-%d}'
                + (f' for "{row.label}"' if row.label else '')
            )
    return kept


def select_share_values(
    filings: Sequence[ShareValueFiling],
    *,
    subclass_code: str | None = None,
    series_id: int | None = None,
    aliases: Sequence[FundShareSeriesAlias] = (),
) -> list[ShareValue]:
    """The share values of one priced unit, one per filing date.

    Daily filings: the rows of the chosen subclass, or of the class itself
    when none was chosen.

    FIDC filings with a chosen series: the row whose label is a confirmed alias
    of that series on that date. Another series' rows are ignored. When the
    series has no row and a label nobody confirmed carries shares, the fund
    fails: it may be the same series renamed, and guessing is how the wrong
    series gets priced. Rows without shares price nothing and are ignored.

    FIDC filings require a confirmed series even if only one carries shares.
    Otherwise successive files could silently price different series.
    """
    by_date: dict[date, list[ShareValueFiling]] = defaultdict(list)
    for filing in filings:
        by_date[filing.date].append(filing)

    values: list[ShareValue] = []
    for day in sorted(by_date):
        rows = by_date[day]
        if all(row.label is None for row in rows):
            matching = _one_per_key(
                (row for row in rows if row.subclass_code == subclass_code),
                key=lambda row: row.subclass_code,
            )
            for row in matching.values():
                if _is_price(row.share_value):
                    values.append(_checked(row))
            continue

        labelled = _one_per_key(rows, key=lambda row: normalize_series_label(row.label or ''))
        if series_id is None:
            candidates = [
                row
                for row in labelled.values()
                if _is_price(row.share_value) and (row.shares is None or row.shares > 0)
            ]
            if len(candidates) > 1:
                raise AmbiguousShareClass(
                    f'{len(candidates)} series with shares outstanding on {day:%Y-%m-%d} '
                    f'({", ".join(sorted(row.label or "" for row in candidates))}); '
                    'choose the series of the asset'
                )
            if candidates:
                raise MissingShareSeries(
                    'Choose and confirm the series of this fund before ingestion'
                )
            continue

        effective = [alias for alias in aliases if alias.applies_to(day)]
        mine = {alias.label for alias in effective if alias.fund_share_series_id == series_id}
        known = {alias.label for alias in effective}
        matched = [row for label, row in labelled.items() if label in mine]
        if len(matched) > 1:
            raise ConflictingShareValueFiling(
                f'The series is filed under {len(matched)} labels on {day:%Y-%m-%d}'
            )
        if matched:
            if _is_price(matched[0].share_value):
                values.append(_checked(matched[0]))
            continue
        unknown = sorted(
            row.label or ''
            for label, row in labelled.items()
            if label not in known and (row.shares is None or row.shares > 0)
        )
        if unknown:
            raise UnknownShareSeriesLabel(
                f'The series was not filed on {day:%Y-%m-%d} under a confirmed label, and '
                f'unconfirmed labels carry shares: {", ".join(unknown)}. Confirm which one '
                'is the series of the asset.'
            )
    return values


def split_for_purchase(
    values: Sequence[ShareValue], since: date
) -> tuple[list[ShareValue], ShareValue | None]:
    """Values from the purchase on, and the last one before it (a seed candidate).

    A value on the purchase date is both: it is kept and it prices that day.
    """
    kept = [value for value in values if value.date >= since]
    before = [value for value in values if value.date < since]
    seed = max(before, key=lambda value: value.date) if before else None
    return kept, seed


# ---------------------------------------------------------------------------
# Which files a priced unit needs
# ---------------------------------------------------------------------------

#: How far back a routine run re-reads files it already applied, measured from
#: the latest share value stored. Covers corrections filed shortly after.
ROUTINE_OVERLAP = timedelta(days=35)
#: The daily dataset re-publishes M-2 through M-11 weekly (M and M-1 daily).
REVISION_MONTHS = range(2, 12)


class IngestionMode(StrEnum):
    ROUTINE = 'routine'
    REVISION = 'revision'
    FORCE = 'force'


class FileReason(StrEnum):
    ROUTINE = 'routine'
    COVERAGE = 'coverage'
    REVISION = 'revision'
    SEED = 'seed'


@dataclass(frozen=True)
class PublishedFile:
    dataset: ShareValueDataset
    period: str
    path: str
    first_day: date
    last_day: date

    @property
    def key(self) -> tuple[str, str]:
        return (self.dataset.value, self.period)


@dataclass
class UnitState:
    """What is known about one priced unit before any file is read."""

    asset_id: int
    dataset: ShareValueDataset
    since: date
    selection_version: int
    latest_quote_date: date | None = None
    #: The latest stored share value dated on or before ``since``.
    seed_date: date | None = None
    coverage: Sequence[FundShareValueCoverage] = ()
    #: ``source_file.id`` and ``content_version`` of files seen before, by key.
    known_files: dict[tuple[str, str], SourceFile] = field(default_factory=dict)


@dataclass(frozen=True)
class FileNeed:
    asset_id: int
    file: PublishedFile
    reason: FileReason
    #: Whether a ``304`` may skip this file for this unit.
    covered: bool


def need_from(file: PublishedFile, since: date) -> date:
    """The first date a file must have been applied from, for a purchase on ``since``."""
    return max(since, file.first_day)


def is_covered(unit: UnitState, file: PublishedFile) -> bool:
    known = unit.known_files.get(file.key)
    if known is None or known.id is None or not known.content_version:
        return False
    required_from = need_from(file, unit.since)
    return any(
        coverage.source_file_id == known.id
        and coverage.content_version == known.content_version
        and coverage.selection_version == unit.selection_version
        and coverage.covered_from <= required_from
        and coverage.covered_to >= file.last_day
        for coverage in unit.coverage
    )


def file_containing(files: Sequence[PublishedFile], day: date) -> PublishedFile | None:
    for file in files:
        if file.first_day <= day <= file.last_day:
            return file
    return None


def _months_before(today: date, months: int) -> date:
    index = today.year * 12 + today.month - 1 - months
    return date(index // 12, index % 12 + 1, 1)


def seed_is_proven(unit: UnitState, files: Sequence[PublishedFile]) -> bool:
    """A stored seed stands when every file from it to the purchase was applied:
    nothing later than it and not after the purchase can be missing."""
    if unit.seed_date is None:
        return False
    return all(
        is_covered(unit, file)
        for file in files
        if file.last_day >= unit.seed_date and file.first_day <= unit.since
    )


def forward_needs(
    unit: UnitState,
    files: Sequence[PublishedFile],
    *,
    today: date,
    mode: IngestionMode,
) -> list[FileNeed]:
    """Files from the purchase (or the proven seed) to today, and whether each
    must be requested this run.

    Force reads everything. Otherwise a file is requested when it was never
    applied in its known version, when it falls in the routine overlap, or, on
    a revision sweep, when it may have been re-published since.
    """
    proven = mode != IngestionMode.FORCE and seed_is_proven(unit, files)
    start = unit.seed_date if proven and unit.seed_date else unit.since
    window_start = (
        unit.latest_quote_date - ROUTINE_OVERLAP if unit.latest_quote_date else unit.since
    )
    revision_floor = _months_before(today, max(REVISION_MONTHS))
    revision_ceiling = _months_before(today, min(REVISION_MONTHS) - 1)
    needs = []
    for file in files:
        if file.last_day < start or file.first_day > today:
            continue
        covered = mode != IngestionMode.FORCE and is_covered(unit, file)
        if mode == IngestionMode.FORCE or not covered:
            reason = FileReason.COVERAGE
        elif file.last_day >= window_start:
            reason = FileReason.ROUTINE
        elif mode == IngestionMode.REVISION and (
            unit.dataset == ShareValueDataset.FIDC_MONTHLY
            or (file.last_day >= revision_floor and file.first_day < revision_ceiling)
        ):
            reason = FileReason.REVISION
        else:
            continue
        needs.append(FileNeed(unit.asset_id, file, reason, covered))
    return needs


def pending_months(files: Sequence[PublishedFile], since: date, today: date) -> list[str]:
    """Months from the purchase to today with no file published yet."""
    latest = max((file.last_day for file in files), default=None)
    months = []
    cursor = date(since.year, since.month, 1)
    while cursor <= today:
        if latest is None or cursor > latest:
            months.append(f'{cursor:%Y%m}')
        cursor = _months_before(cursor, -1)
    return months


def previous_files(files: Sequence[PublishedFile], before: date) -> list[PublishedFile]:
    """Files entirely before ``before``, latest first: the seed search path.

    Finite by construction — it ends at the earliest file the source lists.
    """
    return sorted(
        (file for file in files if file.last_day < before),
        key=lambda file: file.first_day,
        reverse=True,
    )
