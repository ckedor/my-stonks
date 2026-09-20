from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.modules.market_data.domain.fund_registry import (
    FundShareSeriesAlias,
    normalize_series_label,
)
from app.modules.market_data.domain.fund_share_value import (
    AmbiguousShareClass,
    ConflictingShareValueFiling,
    FileReason,
    FundShareValueCoverage,
    IngestionMode,
    MissingShareSeries,
    PublishedFile,
    ShareValueDataset,
    ShareValueFiling,
    ShareValueOutOfRange,
    SourceFile,
    UnitState,
    UnknownShareSeriesLabel,
    UnsupportedFundKind,
    forward_needs,
    is_covered,
    pending_months,
    previous_files,
    select_share_values,
    share_value_dataset,
    split_for_purchase,
)
from app.modules.market_data.service.fund_share_value_ingestion_service import revision_due

PLGN = '55139905000139'
JULY = date(2026, 7, 31)


def fidc(day, label, shares, value):
    return ShareValueFiling(
        cnpj=PLGN, date=day, label=label, shares=Decimal(shares), share_value=Decimal(value)
    )


def daily(day, value, subclass=None):
    return ShareValueFiling(cnpj=PLGN, date=day, subclass_code=subclass, share_value=Decimal(value))


def alias(series_id, label, valid_from=None, valid_to=None):
    return FundShareSeriesAlias(
        fund_share_series_id=series_id,
        fund_registry_class_id=1,
        label=normalize_series_label(label),
        valid_from=valid_from,
        valid_to=valid_to,
    )


# ---------------------------------------------------------------------------
# selection
# ---------------------------------------------------------------------------


def test_even_a_single_series_requires_confirmation_and_cannot_switch_between_months():
    with pytest.raises(MissingShareSeries, match='confirm the series'):
        select_share_values([
            fidc(JULY, 'Senior', '10', '1'),
            fidc(date(2026, 8, 31), 'Subordinada', '10', '10'),
        ])

    with pytest.raises(UnknownShareSeriesLabel, match='Subordinada'):
        select_share_values(
            [fidc(JULY, 'Senior', '10', '1'), fidc(date(2026, 8, 31), 'Subordinada', '10', '10')],
            series_id=7,
            aliases=[alias(7, 'Senior')],
        )


def test_two_series_with_shares_and_no_choice_is_ambiguous():
    with pytest.raises(AmbiguousShareClass, match='2 series'):
        select_share_values([
            fidc(JULY, 'Subclasse Senior Série 1', '10', '1.1'),
            fidc(JULY, 'Subclasse Senior Série 2', '10', '1.2'),
        ])


def test_a_label_nobody_confirmed_fails_even_when_it_is_the_only_one_with_shares():
    with pytest.raises(UnknownShareSeriesLabel, match='Subclasse Senior Série 1'):
        select_share_values(
            [
                fidc(date(2025, 6, 30), 'Subclasse Senior Série 1', '27587584.51', '1.15'),
                fidc(date(2025, 6, 30), 'Subclasse Subordinada Subordinada 1 |', '0', '0'),
            ],
            series_id=7,
            aliases=[alias(7, 'Subclasse Senior Subclasse 1')],
        )


def test_confirmed_aliases_replay_both_labels_as_one_series():
    aliases = [
        alias(7, 'Subclasse Senior Subclasse 1', valid_from=date(2026, 6, 1)),
        alias(7, 'Subclasse Senior Série 1', valid_to=date(2026, 5, 31)),
    ]
    values = select_share_values(
        [
            fidc(date(2025, 6, 30), 'Subclasse Senior Série 1', '27587584.51', '1.15'),
            fidc(date(2025, 6, 30), 'Subclasse Subordinada Subordinada 1 |', '0', '0'),
            fidc(JULY, 'Subclasse Senior Subclasse 1', '30556890.33', '1.42053670'),
        ],
        series_id=7,
        aliases=aliases,
    )

    assert [value.value for value in values] == [Decimal('1.15'), Decimal('1.42053670')]


def test_an_alias_outside_its_dates_does_not_apply():
    with pytest.raises(UnknownShareSeriesLabel):
        select_share_values(
            [fidc(JULY, 'Subclasse Senior Série 1', '1', '1.4')],
            series_id=7,
            aliases=[alias(7, 'Subclasse Senior Série 1', valid_to=date(2026, 5, 31))],
        )


def test_another_confirmed_series_is_ignored_and_rows_without_shares_price_nothing():
    values = select_share_values(
        [
            fidc(JULY, 'Senior', '10', '1.4'),
            fidc(JULY, 'Mezanino', '0', '0'),
            fidc(date(2026, 8, 31), 'Mezanino', '5', '2.0'),
        ],
        series_id=8,
        aliases=[alias(7, 'Senior'), alias(8, 'Mezanino')],
    )

    assert [(value.date, value.value) for value in values] == [(date(2026, 8, 31), Decimal('2.0'))]


def test_identical_double_filings_collapse_and_different_ones_conflict():
    same = select_share_values(
        [
            fidc(JULY, 'Senior', '10', '1.4'),
            fidc(JULY, 'senior', '10', '1.4'),
        ],
        series_id=7,
        aliases=[alias(7, 'Senior')],
    )
    assert len(same) == 1

    with pytest.raises(ConflictingShareValueFiling):
        select_share_values([
            fidc(JULY, 'Subclasse Senior Série 1', '5.47218676', '16063472.20016890'),
            fidc(JULY, 'Subclasse Senior Série 1', '5.01954105', '13733421.98518400'),
        ])


def test_a_value_that_cannot_be_stored_as_a_price_fails_the_fund():
    with pytest.raises(ShareValueOutOfRange):
        select_share_values(
            [fidc(JULY, 'Classe Subordinada 1', '1', '398991407407.41')],
            series_id=7,
            aliases=[alias(7, 'Classe Subordinada 1')],
        )


def test_daily_filings_match_the_subclass_only():
    filings = [
        daily(date(2026, 9, 1), '44.63', None),
        daily(date(2026, 9, 1), '73.28', 'RBMFN1747320951'),
        daily(date(2026, 9, 1), '72.96', 'MZMRC1747322915'),
    ]

    assert [v.value for v in select_share_values(filings, subclass_code='MZMRC1747322915')] == [
        Decimal('72.96')
    ]
    assert [v.value for v in select_share_values(filings)] == [Decimal('44.63')]


def test_the_purchase_keeps_later_values_and_the_last_earlier_one_as_seed():
    values = select_share_values([
        daily(date(2026, 9, 8), '1.0'),
        daily(date(2026, 9, 9), '1.1'),
        daily(date(2026, 9, 10), '1.2'),
        daily(date(2026, 9, 11), '1.3'),
    ])

    kept, seed = split_for_purchase(values, date(2026, 9, 10))

    assert [value.date.day for value in kept] == [10, 11]
    assert seed.date == date(2026, 9, 9)


def test_only_known_fund_kinds_file_share_values():
    assert share_value_dataset('FIDC') == ShareValueDataset.FIDC_MONTHLY
    assert share_value_dataset('FIF') == ShareValueDataset.DAILY
    with pytest.raises(UnsupportedFundKind):
        share_value_dataset('FII')


# ---------------------------------------------------------------------------
# planning
# ---------------------------------------------------------------------------


def month(period, dataset=ShareValueDataset.DAILY):
    year, number = int(period[:4]), int(period[4:])
    last = date(year + (number == 12), number % 12 + 1, 1) - date.resolution
    return PublishedFile(
        dataset=dataset, period=period, path=period, first_day=date(year, number, 1), last_day=last
    )


FILES = [month(p) for p in ('202605', '202606', '202607', '202608', '202609')]


def covered_state(since, *, covered_from=None, latest=None, version='v1', selection=1):
    known = {
        file.key: SourceFile(
            id=index, dataset=file.dataset.value, period=file.period, content_version=version
        )
        for index, file in enumerate(FILES, start=1)
    }
    coverage = [
        FundShareValueCoverage(
            source_file_id=known[file.key].id,
            asset_id=1,
            content_version=version,
            selection_version=selection,
            covered_from=covered_from or max(since, file.first_day),
            covered_to=file.last_day,
        )
        for file in FILES
    ]
    return UnitState(
        asset_id=1,
        dataset=ShareValueDataset.DAILY,
        since=since,
        selection_version=1,
        latest_quote_date=latest,
        coverage=coverage,
        known_files=known,
    )


def test_a_first_purchase_needs_every_file_from_it_uncovered():
    state = UnitState(
        asset_id=1, dataset=ShareValueDataset.DAILY, since=date(2026, 7, 10), selection_version=1
    )

    needs = forward_needs(state, FILES, today=date(2026, 9, 17), mode=IngestionMode.ROUTINE)

    assert [(need.file.period, need.reason, need.covered) for need in needs] == [
        ('202607', FileReason.COVERAGE, False),
        ('202608', FileReason.COVERAGE, False),
        ('202609', FileReason.COVERAGE, False),
    ]


def test_routine_rechecks_only_the_overlap_of_covered_files():
    state = covered_state(date(2026, 5, 4), latest=date(2026, 9, 16))

    needs = forward_needs(state, FILES, today=date(2026, 9, 17), mode=IngestionMode.ROUTINE)

    assert [(need.file.period, need.reason, need.covered) for need in needs] == [
        ('202608', FileReason.ROUTINE, True),
        ('202609', FileReason.ROUTINE, True),
    ]


def test_a_retrodated_purchase_is_not_covered_by_what_a_later_one_applied():
    state = covered_state(date(2026, 5, 4), covered_from=date(2026, 7, 10))
    state.since = date(2026, 5, 4)

    assert not is_covered(state, FILES[0])
    needs = forward_needs(state, FILES, today=date(2026, 9, 17), mode=IngestionMode.ROUTINE)
    assert ('202605', FileReason.COVERAGE, False) in [
        (need.file.period, need.reason, need.covered) for need in needs
    ]


def test_a_new_selection_or_content_version_is_not_covered():
    state = covered_state(date(2026, 5, 4), selection=1)
    state.selection_version = 2
    assert not is_covered(state, FILES[0])

    state = covered_state(date(2026, 5, 4))
    state.known_files[FILES[0].key].content_version = 'v2'
    assert not is_covered(state, FILES[0])


def test_the_revision_sweep_rechecks_older_daily_months_within_the_published_window():
    state = covered_state(date(2026, 5, 4), latest=date(2026, 9, 16))

    needs = forward_needs(state, FILES, today=date(2026, 9, 17), mode=IngestionMode.REVISION)

    assert [(need.file.period, need.reason) for need in needs] == [
        ('202605', FileReason.REVISION),
        ('202606', FileReason.REVISION),
        ('202607', FileReason.REVISION),
        ('202608', FileReason.ROUTINE),
        ('202609', FileReason.ROUTINE),
    ]


def test_seed_search_walks_back_to_the_earliest_listed_file_and_months_not_published_are_pending():
    assert [file.period for file in previous_files(FILES, date(2026, 8, 1))] == [
        '202607',
        '202606',
        '202605',
    ]
    fidc_files = [month('202607', ShareValueDataset.FIDC_MONTHLY)]
    assert pending_months(fidc_files, date(2026, 9, 10), date(2026, 9, 17)) == ['202609']


@pytest.mark.parametrize(
    ('last_success', 'now', 'due'),
    [
        (None, datetime(2026, 9, 17, 12, tzinfo=UTC), True),
        # Tuesday 2026-09-15 09:15 BRT done; Thursday is not due again.
        (datetime(2026, 9, 15, 12, 15, tzinfo=UTC), datetime(2026, 9, 17, 12, tzinfo=UTC), False),
        # Last week's sweep: the Tuesday run failed, so Thursday is still due.
        (datetime(2026, 9, 8, 12, 15, tzinfo=UTC), datetime(2026, 9, 17, 12, tzinfo=UTC), True),
        # Monday after a Tuesday sweep: not yet.
        (datetime(2026, 9, 15, 12, 15, tzinfo=UTC), datetime(2026, 9, 21, 12, tzinfo=UTC), False),
    ],
)
def test_the_weekly_revision_sweep_stays_due_until_it_succeeds(last_success, now, due):
    assert revision_due(last_success, now) is due
