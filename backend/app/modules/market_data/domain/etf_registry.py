"""Foreign ETFs as their regulators register them.

The registry mirrors what the Brazilian fund registry is for a FII: reference
data, the regulator's whole list, refreshed weekly and written before anybody
links to it. A row is not an asset. An asset — one listing, a ticker on one
exchange — points at the registered class it trades.

Two regulators answer, and they agree on one key. The SEC registers an
American ETF as a series of a trust, with share classes that carry a ticker;
FIRDS (ESMA) registers a UCITS ETF by ISIN, one ISIN per share class. Both
publish a LEI for every ETF they list, and the LEI is what GLEIF ties to the
fund's manager and umbrella. But an American filer may give every series of a
trust the same LEI, so an American fund is keyed by its series and a UCITS
fund by its LEI; a class, by the SEC class id or the ISIN.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

ISIN_PATTERN = re.compile(r'^[A-Z]{2}[A-Z0-9]{9}[0-9]$')
LEI_PATTERN = re.compile(r'^[A-Z0-9]{18}[0-9]{2}$')


class EtfRegistrySource(StrEnum):
    SEC = 'sec'
    ESMA = 'esma'


class EtfRegistryStatus(StrEnum):
    #: Present in the source's current list.
    ACTIVE = 'active'
    #: Was, and is no longer. The row stays: an asset may still point at it.
    INACTIVE = 'inactive'


class DistributionPolicy(StrEnum):
    ACCUMULATING = 'accumulating'
    DISTRIBUTING = 'distributing'
    MIXED = 'mixed'


#: ISO 10962, category C (collective investment vehicles), group E (ETFs).
CFI_ETF_PREFIX = 'CE'

#: The second attribute of an ETF's CFI code — the fourth letter — is its
#: distribution policy. `X` means not applicable or unknown, and says nothing.
_CFI_DISTRIBUTION = {
    'I': DistributionPolicy.DISTRIBUTING,
    'G': DistributionPolicy.ACCUMULATING,
    'J': DistributionPolicy.MIXED,
}


def distribution_policy_from_cfi(cfi_code: str | None) -> DistributionPolicy | None:
    """What an ETF's CFI code says it does with income, if it says anything.

    Read from the regulator's classification rather than from the name: "Acc"
    in a name is marketing, and the CFI is what the issuer filed.
    """
    if not cfi_code or len(cfi_code) != 6 or not cfi_code.startswith(CFI_ETF_PREFIX):
        return None
    return _CFI_DISTRIBUTION.get(cfi_code[3])


def is_isin(value: str | None) -> bool:
    """Shape and check digit (ISO 6166): letters become two digits, then Luhn."""
    if not value or not ISIN_PATTERN.match(value):
        return False
    digits = ''.join(str(int(char, 36)) for char in value[:-1])
    total = 0
    for position, char in enumerate(reversed(digits)):
        number = int(char)
        if position % 2 == 0:
            number *= 2
            if number > 9:
                number -= 9
        total += number
    return (10 - total % 10) % 10 == int(value[-1])


def is_lei(value: str | None) -> bool:
    """Shape and check digits (ISO 17442): the whole code is 1 modulo 97."""
    if not value or not LEI_PATTERN.match(value):
        return False
    return int(''.join(str(int(char, 36)) for char in value)) % 97 == 1


@dataclass(eq=False, kw_only=True)
class EtfRegistry:
    """One registered ETF: an American series or a UCITS sub-fund."""

    id: int | None = None
    #: The fund's LEI. Always there for a UCITS fund, whose key it is; for an
    #: American one only when the filer gave it to that series alone.
    lei: str | None = None
    source: str
    sec_series_id: str | None = None
    name: str
    #: Where the fund is established, which is not where it trades: CSPX
    #: trades in London and is Irish. It decides the withholding on what it
    #: earns and whether an American estate tax reaches it.
    domicile: str
    umbrella_institution_id: int | None = None
    tracks_index: bool | None = None
    leveraged_or_inverse: bool | None = None
    fund_of_funds: bool | None = None
    status: str = EtfRegistryStatus.ACTIVE
    refreshed_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class EtfRegistryManager:
    """A manager of a registered ETF. A fund may have more than one, so they
    live apart from it, one row per fund and institution."""

    etf_registry_id: int
    institution_id: int


@dataclass(eq=False, kw_only=True)
class EtfRegistryClass:
    """A share class: what an asset is a listing of."""

    id: int | None = None
    etf_registry_id: int
    sec_class_id: str | None = None
    isin: str | None = None
    ticker: str | None = None
    name: str
    currency: str | None = None
    distribution_policy: str | None = None
    cfi_code: str | None = None
    status: str = EtfRegistryStatus.ACTIVE
    refreshed_at: datetime | None = None
    fund: EtfRegistry | None = None


class EtfHoldingSource(StrEnum):
    """Where a holding report was read from."""

    #: The American fund's N-PORT filing with the SEC.
    SEC_NPORT = 'sec_nport'
    #: The constituents file DWS publishes for each Xtrackers class, by ISIN.
    DWS = 'dws'


#: The UCITS classes whose manager publishes a holdings file this app reads,
#: by the class's ISIN. No regulator publishes a UCITS fund's holdings, so
#: each class is added by hand, once someone has seen its manager's file —
#: the registry names the manager but says nothing about where its files are.
MANAGER_HOLDINGS_FILES: dict[str, EtfHoldingSource] = {
    # EXUS: Xtrackers MSCI World ex USA UCITS ETF 1C.
    'IE0006WW1TQ4': EtfHoldingSource.DWS,
}


def holdings_source(fund: EtfRegistry, class_isin: str | None) -> EtfHoldingSource | None:
    """Where this ETF's holdings are read from, or None when nowhere is."""
    if fund.source == EtfRegistrySource.SEC:
        return EtfHoldingSource.SEC_NPORT
    return MANAGER_HOLDINGS_FILES.get(class_isin or '')


@dataclass(eq=False, kw_only=True)
class EtfHoldingReport:
    """What a registered ETF held on one date, as its source states it.

    An American ETF files it with the SEC as N-PORT: every month, made public
    only for the last month of each fiscal quarter, about two months later. A
    UCITS ETF files it with no regulator; for some, the manager publishes a
    file of its own, daily. Either way a report carries the date it describes,
    and the newest is the most recent picture there is, not the current one.
    """

    id: int | None = None
    etf_registry_id: int
    report_date: date
    source: str
    #: What it was read from: the N-PORT accession, or the date of a
    #: manager's file. The same one is not written twice.
    accession: str
    net_assets: Decimal | None = None
    total_assets: Decimal | None = None
    holdings_count: int = 0
    fetched_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class EtfHolding:
    """One line of a holding report."""

    id: int | None = None
    report_id: int
    name: str
    title: str | None = None
    isin: str | None = None
    cusip: str | None = None
    lei: str | None = None
    ticker: str | None = None
    #: N-PORT's asset category: `EC` equity, `DBT` debt, `STIV` short-term
    #: investment vehicle, `DE` derivative. None from a manager's file.
    asset_category: str | None = None
    country: str | None = None
    currency: str | None = None
    balance: Decimal | None = None
    #: `NS` shares, `PA` principal amount, `NC` contracts.
    units: str | None = None
    value_usd: Decimal | None = None
    #: Of the fund's net assets, as a ratio: 0.08 is 8%.
    weight: Decimal | None = None
    #: The registered asset with the same ISIN, when there is one.
    asset_id: int | None = None
