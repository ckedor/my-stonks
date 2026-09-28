"""What the ETF regulators' files say, read into plain records.

Synchronous and file-bound: run these off the event loop. Nothing here knows
about assets or the database.

Each layout is checked against the header the file actually carries, not the
published dictionary, and a missing column fails the file — the same rule the
CVM files follow.
"""

from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from xml.etree import ElementTree

from app.infra.exceptions import IntegrationBadResponse
from app.modules.market_data.domain.etf_registry import (
    distribution_policy_from_cfi,
    is_isin,
    is_lei,
)

# --- SEC: N-CEN ---------------------------------------------------------------

#: The members read, and the columns each must carry.
NCEN_COLUMNS = {
    'SUBMISSION.tsv': ('ACCESSION_NUMBER', 'FILING_DATE', 'REPORT_ENDING_PERIOD'),
    'REGISTRANT.tsv': (
        'ACCESSION_NUMBER',
        'REGISTRANT_NAME',
        'CIK',
        'LEI',
        'COUNTRY',
        'INVESTMENT_COMPANY_TYPE',
    ),
    'FUND_REPORTED_INFO.tsv': (
        'FUND_ID',
        'ACCESSION_NUMBER',
        'FUND_NAME',
        'SERIES_ID',
        'LEI',
        'IS_ETF',
        'IS_INDEX',
        'IS_MULTI_INVERSE_INDEX',
        'IS_FUND_OF_FUND',
    ),
    'ADVISER.tsv': ('FUND_ID', 'ADVISER_TYPE', 'ADVISER_NAME', 'ADVISER_LEI', 'COUNTRY'),
    'SHARES_OUTSTANDING.tsv': ('FUND_ID', 'CLASS_NAME', 'CLASS_ID', 'TICKER'),
    'SECURITY_EXCHANGE.tsv': ('FUND_ID', 'FUND_EXCHANGE'),
}

#: The registration form of an open-end fund. A closed-end fund (N-2) trades
#: on an exchange too, and is not an ETF.
OPEN_END_FORM = 'N-1A'

#: The fund's own adviser. A sub-adviser runs part of the money under it, and
#: a terminated one no longer runs any.
ADVISER_TYPE = 'Advisor'

_NCEN_DATE = '%d-%b-%Y'


@dataclass(frozen=True)
class LegalEntity:
    lei: str
    name: str
    #: ISO 3166 alpha-2. An entity whose source gives no country is not read:
    #: the registry of legal entities requires one, and a guess would be wrong
    #: for the Irish and Luxembourgish managers that make up most of Europe's.
    country: str


@dataclass(frozen=True)
class ShareClass:
    class_id: str
    name: str
    ticker: str | None


@dataclass
class NcenEtf:
    series_id: str
    #: None when the filer gave none, or one that fails its check digits —
    #: Direxion files `77IOI17PEDG6547SGI25` for TYO.
    lei: str | None
    name: str
    tracks_index: bool
    leveraged_or_inverse: bool
    fund_of_funds: bool
    trust: LegalEntity | None
    advisers: list[LegalEntity]
    classes: list[ShareClass]
    #: Which filing this came from: its period, then when it was filed, so an
    #: amendment beats the filing it amends.
    filed: tuple[date, date] = field(default=(date.min, date.min))


def _checkbox(value: str) -> bool:
    """N-CEN checkboxes are `Y` or empty. Empty is "not checked", not unknown."""
    return value.strip().upper() == 'Y'


def _parse_date(value: str) -> date:
    try:
        return datetime.strptime(value.strip(), _NCEN_DATE).date()
    except ValueError:
        return date.min


def _country(value: str | None) -> str | None:
    value = (value or '').strip().upper()
    return value if len(value) == 2 and value.isalpha() else None


def _entity(lei: str, name: str, country: str) -> LegalEntity | None:
    lei = lei.strip().upper()
    country_code = _country(country)
    if not is_lei(lei) or country_code is None:
        return None
    return LegalEntity(lei=lei, name=name.strip() or lei, country=country_code)


def _is_etf(checked: bool, open_end: bool, listed: bool) -> bool:
    """The ETF box, or what makes a fund one: open-end and traded on an exchange.

    Filers miss the box. Of the open-end funds listed on an exchange in a year
    of filings, 42 did not check it — 39 checked "exchange-traded managed fund"
    instead, 3 checked nothing — and every one of them is an ETF by name,
    prospectus and listing.
    """
    return checked or (open_end and listed)


def _valid_lei(value: str) -> str | None:
    value = value.strip().upper()
    return value if is_lei(value) else None


def _ncen_rows(archive: zipfile.ZipFile, member: str) -> Iterator[dict[str, str]]:
    try:
        raw = archive.open(member)
    except KeyError as exc:
        raise IntegrationBadResponse(f'N-CEN data set has no {member}', provider='sec') from exc
    with raw:
        reader = csv.DictReader(
            io.TextIOWrapper(raw, encoding='utf-8', errors='replace', newline=''),
            delimiter='\t',
        )
        missing = [
            column for column in NCEN_COLUMNS[member] if column not in (reader.fieldnames or [])
        ]
        if missing:
            raise IntegrationBadResponse(
                f'N-CEN {member} is missing {", ".join(missing)}', provider='sec'
            )
        yield from reader


def read_ncen_etfs(paths: Iterable[Path]) -> dict[str, NcenEtf]:
    """Every ETF the N-CEN data sets describe, from its most recent filing.

    A fund files once a year, so several quarters are read together; the same
    series in two of them is the same fund reported twice, and the later
    report wins.
    """
    etfs: dict[str, NcenEtf] = {}
    for path in paths:
        with zipfile.ZipFile(path) as archive:
            submissions = {
                row['ACCESSION_NUMBER']: (
                    _parse_date(row['REPORT_ENDING_PERIOD']),
                    _parse_date(row['FILING_DATE']),
                )
                for row in _ncen_rows(archive, 'SUBMISSION.tsv')
            }
            trusts: dict[str, LegalEntity | None] = {}
            open_end: set[str] = set()
            for row in _ncen_rows(archive, 'REGISTRANT.tsv'):
                trusts[row['ACCESSION_NUMBER']] = _entity(
                    row['LEI'], row['REGISTRANT_NAME'], row['COUNTRY']
                )
                if row['INVESTMENT_COMPANY_TYPE'].strip() == OPEN_END_FORM:
                    open_end.add(row['ACCESSION_NUMBER'])
            listed = {
                row['FUND_ID']
                for row in _ncen_rows(archive, 'SECURITY_EXCHANGE.tsv')
                if row['FUND_EXCHANGE'].strip()
            }
            advisers: dict[str, list[LegalEntity]] = defaultdict(list)
            for row in _ncen_rows(archive, 'ADVISER.tsv'):
                if row['ADVISER_TYPE'].strip() != ADVISER_TYPE:
                    continue
                adviser = _entity(row['ADVISER_LEI'], row['ADVISER_NAME'], row['COUNTRY'])
                # The same adviser is listed twice by some filers, with its
                # name spelled two ways; the LEI is what makes it the same.
                listed = {known.lei for known in advisers[row['FUND_ID']]}
                if adviser and adviser.lei not in listed:
                    advisers[row['FUND_ID']].append(adviser)
            classes: dict[str, list[ShareClass]] = defaultdict(list)
            for row in _ncen_rows(archive, 'SHARES_OUTSTANDING.tsv'):
                class_id = row['CLASS_ID'].strip()
                if class_id:
                    classes[row['FUND_ID']].append(
                        ShareClass(
                            class_id=class_id,
                            name=row['CLASS_NAME'].strip(),
                            ticker=row['TICKER'].strip().upper() or None,
                        )
                    )

            for row in _ncen_rows(archive, 'FUND_REPORTED_INFO.tsv'):
                if not _is_etf(
                    _checkbox(row['IS_ETF']),
                    row['ACCESSION_NUMBER'] in open_end,
                    row['FUND_ID'] in listed,
                ):
                    continue
                series_id = row['SERIES_ID'].strip()
                if not series_id:
                    continue
                filed = submissions.get(row['ACCESSION_NUMBER'], (date.min, date.min))
                known = etfs.get(series_id)
                if known is not None and known.filed >= filed:
                    continue
                etfs[series_id] = NcenEtf(
                    series_id=series_id,
                    lei=_valid_lei(row['LEI']),
                    name=row['FUND_NAME'].strip() or series_id,
                    tracks_index=_checkbox(row['IS_INDEX']),
                    leveraged_or_inverse=_checkbox(row['IS_MULTI_INVERSE_INDEX']),
                    fund_of_funds=_checkbox(row['IS_FUND_OF_FUND']),
                    trust=trusts.get(row['ACCESSION_NUMBER']),
                    advisers=advisers.get(row['FUND_ID'], []),
                    classes=classes.get(row['FUND_ID'], []),
                    filed=filed,
                )
    return etfs


# --- SEC: one N-CEN filing, as EDGAR serves it ---------------------------------

#: `fundType` values that mark the fund, as the filings spell them.
_ETF_FUND_TYPE = 'Exchange-Traded Fund'
_FUND_OF_FUNDS_TYPE = 'Fund of Funds'
_INDEX_FUND_TYPE = 'Index Fund'
#: "Inverse of a benchmark", "Multiple of a benchmark".
_LEVERAGED_FUND_TYPE_WORDS = ('inverse', 'multiple')


def _local(tag: str) -> str:
    return tag.rsplit('}', 1)[-1]


def _child(element, name: str):
    return next((child for child in element if _local(child.tag) == name), None)


def _text(element, name: str) -> str:
    child = _child(element, name)
    return (child.text or '').strip() if child is not None else ''


def _descendants(element, name: str):
    return (node for node in element.iter() if _local(node.tag) == name)


def read_ncen_document(content: bytes, *, filed: date) -> dict[str, NcenEtf]:
    """The ETFs one N-CEN filing describes, read from its XML document.

    The quarterly data sets leave out filings EDGAR holds — Amplify's of
    December 2025 is on EDGAR and in no data set — so a series they miss is
    read from its trust's latest filing instead. Same fields, same rules.
    """
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as exc:
        raise IntegrationBadResponse('N-CEN document is not valid XML', provider='sec') from exc
    registrant = next(_descendants(root, 'registrantInfo'), None)
    period = next(_descendants(root, 'generalInfo'), None)
    if registrant is None or period is None:
        raise IntegrationBadResponse('N-CEN document has no registrant', provider='sec')
    trust = _entity(
        _text(registrant, 'registrantLei'),
        _text(registrant, 'registrantFullName'),
        _text(registrant, 'registrantcountry'),
    )
    try:
        period_end = date.fromisoformat(period.get('reportEndingPeriod', ''))
    except ValueError:
        period_end = date.min
    open_end = any(
        (node.text or '').strip() == OPEN_END_FORM
        for node in _descendants(root, 'investmentCompanyType')
    )
    # Item E lists each exchange-traded series with where it trades.
    listed = {
        _text(node, 'etfSeriesId')
        for node in root.iter()
        if _child(node, 'etfSeriesId') is not None
        # An element without children is falsy, so `any()` over them lies.
        and next(_descendants(node, 'securityExchange'), None) is not None
    }

    etfs: dict[str, NcenEtf] = {}
    for fund in _descendants(root, 'managementInvestmentQuestion'):
        types = [(node.text or '').strip() for node in _descendants(fund, 'fundType')]
        types += [node.get('fundType', '') for node in _descendants(fund, 'indexFundInfo')]
        series_id = _text(fund, 'mgmtInvSeriesId')
        if not series_id or not _is_etf(_ETF_FUND_TYPE in types, open_end, series_id in listed):
            continue
        advisers: list[LegalEntity] = []
        for node in _descendants(fund, 'investmentAdviser'):
            place = _child(node, 'investmentAdviserStateCountry')
            adviser = _entity(
                _text(node, 'investmentAdviserLei'),
                _text(node, 'investmentAdviserName'),
                place.get('investmentAdviserCountry', '') if place is not None else '',
            )
            if adviser and adviser.lei not in {known.lei for known in advisers}:
                advisers.append(adviser)
        etfs[series_id] = NcenEtf(
            series_id=series_id,
            lei=_valid_lei(_text(fund, 'mgmtInvLei')),
            name=_text(fund, 'mgmtInvFundName') or series_id,
            tracks_index=_INDEX_FUND_TYPE in types,
            leveraged_or_inverse=any(
                word in kind.lower() for kind in types for word in _LEVERAGED_FUND_TYPE_WORDS
            ),
            fund_of_funds=_FUND_OF_FUNDS_TYPE in types,
            trust=trust,
            advisers=advisers,
            classes=[
                ShareClass(
                    class_id=node.get('sharesOutstandingClassId', '').strip(),
                    name=node.get('sharesOutstandingClassName', '').strip(),
                    ticker=node.get('sharesOutstandingTickerSymbol', '').strip().upper() or None,
                )
                for node in _descendants(fund, 'sharesOutstanding')
                if node.get('sharesOutstandingClassId', '').strip()
            ],
            filed=(period_end, filed),
        )
    return etfs


def current_tickers(rows: Iterable[list]) -> dict[str, dict[str, str]]:
    """Series id -> {class id: ticker}, from the SEC's current ticker file."""
    by_series: dict[str, dict[str, str]] = defaultdict(dict)
    for _cik, series_id, class_id, symbol in rows:
        if series_id and class_id and symbol:
            by_series[str(series_id)][str(class_id)] = str(symbol).strip().upper()
    return by_series


# --- ESMA: FIRDS --------------------------------------------------------------


@dataclass(frozen=True)
class FirdsClass:
    isin: str
    lei: str
    name: str
    cfi_code: str | None
    currency: str | None

    @property
    def distribution_policy(self):
        return distribution_policy_from_cfi(self.cfi_code)


def firds_class(document: dict) -> FirdsClass | None:
    """One FIRDS document as a class, or None if its ISIN or LEI is not valid."""
    isin = (document.get('isin') or '').strip().upper()
    lei = (document.get('lei') or '').strip().upper()
    if not is_isin(isin) or not is_lei(lei):
        return None
    cfi = (document.get('gnr_cfi_code') or '').strip().upper() or None
    currency = (document.get('gnr_notional_curr_code') or '').strip().upper() or None
    return FirdsClass(
        isin=isin,
        lei=lei,
        name=(document.get('gnr_full_name') or '').strip() or isin,
        cfi_code=cfi if cfi and len(cfi) == 6 else None,
        currency=currency if currency and len(currency) == 3 else None,
    )


# --- GLEIF --------------------------------------------------------------------

RELATIONSHIP_COLUMNS = (
    'Relationship.StartNode.NodeID',
    'Relationship.EndNode.NodeID',
    'Relationship.RelationshipType',
    'Relationship.RelationshipStatus',
)
MANAGED_BY = 'IS_FUND-MANAGED_BY'
SUBFUND_OF = 'IS_SUBFUND_OF'
ACTIVE_RELATIONSHIP = 'ACTIVE'


@dataclass
class FundRelationships:
    #: Fund LEI -> the LEIs that manage it.
    managers: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    #: Sub-fund LEI -> its umbrella's LEI.
    umbrellas: dict[str, str] = field(default_factory=dict)
    #: Every LEI that is an umbrella and nothing else. A class whose issuer
    #: LEI is one of these was filed under the umbrella, and which sub-fund it
    #: belongs to is not in the data.
    umbrella_leis: set[str] = field(default_factory=set)


def read_fund_relationships(path: Path, funds: set[str]) -> FundRelationships:
    """Managers and umbrellas of ``funds``, from GLEIF's relationship file."""
    result = FundRelationships()
    subfunds: set[str] = set()
    with zipfile.ZipFile(path) as archive:
        members = [name for name in archive.namelist() if name.endswith('.csv')]
        if not members:
            raise IntegrationBadResponse('GLEIF relationship file has no CSV', provider='gleif')
        with archive.open(members[0]) as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8', newline=''))
            missing = [c for c in RELATIONSHIP_COLUMNS if c not in (reader.fieldnames or [])]
            if missing:
                raise IntegrationBadResponse(
                    f'GLEIF relationship file is missing {", ".join(missing)}', provider='gleif'
                )
            for row in reader:
                if row['Relationship.RelationshipStatus'] != ACTIVE_RELATIONSHIP:
                    continue
                kind = row['Relationship.RelationshipType']
                start = row['Relationship.StartNode.NodeID']
                end = row['Relationship.EndNode.NodeID']
                if kind == SUBFUND_OF:
                    result.umbrella_leis.add(end)
                    subfunds.add(start)
                    if start in funds:
                        result.umbrellas[start] = end
                elif kind == MANAGED_BY and start in funds and end not in result.managers[start]:
                    result.managers[start].append(end)
    # A sub-fund is a fund even when something declares itself a sub-fund of
    # it: a feeder of iShares Core MSCI EM IMI does, and that does not turn
    # the ETF into an umbrella.
    result.umbrella_leis -= subfunds
    return result


def lei_entity(record: dict) -> LegalEntity | None:
    """A GLEIF LEI record as a legal entity: its legal name and jurisdiction."""
    lei = (record.get('id') or '').strip().upper()
    entity = (record.get('attributes') or {}).get('entity') or {}
    name = ((entity.get('legalName') or {}).get('name') or '').strip()
    if not is_lei(lei) or not name:
        return None
    # A jurisdiction is a country or a subdivision of one (`US-DE`); the legal
    # address always has a country, and answers when the jurisdiction does not.
    country = _country((entity.get('jurisdiction') or '')[:2]) or _country(
        (entity.get('legalAddress') or {}).get('country')
    )
    if country is None:
        return None
    return LegalEntity(lei=lei, name=name, country=country)


# --- SEC: N-PORT, what an ETF holds -------------------------------------------

_NOT_AVAILABLE = {'', 'N/A', 'NA', '000000000'}


@dataclass
class NportReport:
    series_id: str
    report_date: date
    net_assets: Decimal | None
    total_assets: Decimal | None
    holdings: list[dict]


def _value(text: str | None) -> str | None:
    text = (text or '').strip()
    return None if text.upper() in _NOT_AVAILABLE else text


def _decimal(text: str | None) -> Decimal | None:
    value = _value(text)
    if value is None:
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def _identifier(holding, kind: str) -> str | None:
    """`<identifiers><isin value="…"/>`, the way N-PORT nests them."""
    for identifiers in _descendants(holding, 'identifiers'):
        node = _child(identifiers, kind)
        if node is not None:
            return _value(node.get('value'))
    return None


def read_nport_document(content: bytes) -> NportReport:
    """One N-PORT filing: the fund, the date it describes, and every holding.

    A holding's weight is filed as percentage points of net assets (8.18 for
    8.18%) and is returned as a ratio, as every proportion in the domain is.
    A derivative has no issuer name — "N/A" — and is named by its title.
    """
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as exc:
        raise IntegrationBadResponse('N-PORT document is not valid XML', provider='sec') from exc
    general = next(_descendants(root, 'genInfo'), None)
    fund = next(_descendants(root, 'fundInfo'), None)
    if general is None or fund is None:
        raise IntegrationBadResponse('N-PORT document has no fund section', provider='sec')
    try:
        report_date = date.fromisoformat(_text(general, 'repPdDate'))
    except ValueError as exc:
        raise IntegrationBadResponse('N-PORT document has no report date', provider='sec') from exc

    holdings = []
    for holding in _descendants(root, 'invstOrSec'):
        title = _value(_text(holding, 'title'))
        name = _value(_text(holding, 'name')) or title
        if name is None:
            continue
        isin = _identifier(holding, 'isin')
        weight = _decimal(_text(holding, 'pctVal'))
        conditional = _child(holding, 'assetConditional')
        holdings.append({
            'name': name[:300],
            'title': title[:300] if title else None,
            'isin': isin if is_isin(isin) else None,
            'cusip': (_value(_text(holding, 'cusip')) or '')[:9] or None,
            'lei': _valid_lei(_text(holding, 'lei')),
            'ticker': (_identifier(holding, 'ticker') or '')[:30] or None,
            # A category outside N-PORT's list is filed as `assetConditional`.
            'asset_category': _value(_text(holding, 'assetCat'))
            or (_value(conditional.get('assetCat')) if conditional is not None else None),
            'country': _value(_text(holding, 'invCountry')),
            'currency': _value(_text(holding, 'curCd')),
            'balance': _decimal(_text(holding, 'balance')),
            'units': _value(_text(holding, 'units')),
            'value_usd': _decimal(_text(holding, 'valUSD')),
            'weight': weight / 100 if weight is not None else None,
        })
    return NportReport(
        series_id=_text(general, 'seriesId'),
        report_date=report_date,
        net_assets=_decimal(_text(fund, 'netAssets')),
        total_assets=_decimal(_text(fund, 'totAssets')),
        holdings=holdings,
    )
