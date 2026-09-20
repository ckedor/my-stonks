"""The regulator's fund registry, and what is needed to price a fund from it.

A registry row is reference data, not an asset. The registry lists ~90k funds
and ~37k classes; an asset exists only for the priced unit somebody chose — a
class, optionally narrowed to a subclass or, for a FIDC, to a series of shares.

A FIDC files one share value per series, and the filing names the series with a
free-text label that is not stable over time ("Subclasse Senior Série 1" became
"Subclasse Senior Subclasse 1"). So a series has an internal identity, and the
labels that meant it are recorded as aliases with the dates they were valid.
Nothing here matches a label by similarity: an alias is confirmed by someone, or
it does not exist.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal


@dataclass(eq=False, kw_only=True)
class FundRegistry:
    """One registered fund. Carries who runs it; its classes carry the rest."""

    id: int | None = None
    registry_id: int
    cnpj: str
    name: str
    kind: str
    status: str
    started_at: date | None = None
    cancelled_at: date | None = None
    administrator_name: str | None = None
    administrator_cnpj: str | None = None
    #: The administrator as a legal entity. A fund declares exactly one, so it
    #: fits a foreign key; the manager does not, and stays text below.
    administrator_institution_id: int | None = None
    #: A fund can have several managers; the registry repeats the fund row once
    #: per manager, so the names and documents are kept joined in file order.
    #: 1,040 funds declare more than one and 218 declare a natural person, so
    #: this cannot become a foreign key to a legal entity.
    manager_name: str | None = None
    manager_document: str | None = None
    refreshed_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class FundRegistryClass:
    """The unit with a CNPJ of its own and a share value."""

    id: int | None = None
    registry_id: int
    fund_registry_id: int
    cnpj: str
    name: str
    class_type: str | None = None
    status: str | None = None
    classification: str | None = None
    anbima_classification: str | None = None
    open_ended: bool | None = None
    exclusive: bool | None = None
    target_investors: str | None = None
    long_term_taxation: bool | None = None
    custodian_name: str | None = None
    auditor_name: str | None = None
    equity: Decimal | None = None
    equity_date: date | None = None
    admin_fee: Decimal | None = None
    performance_fee: Decimal | None = None
    performance_benchmark: str | None = None
    minimum_investment: Decimal | None = None
    conversion_days: int | None = None
    redemption_payment_days: int | None = None
    terms_date: date | None = None
    refreshed_at: datetime | None = None
    fund: FundRegistry | None = None


@dataclass(eq=False, kw_only=True)
class FundRegistrySubclass:
    id: int | None = None
    fund_registry_class_id: int
    code: str
    name: str
    status: str | None = None
    target_investors: str | None = None
    pension: bool | None = None
    refreshed_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class FundShareSeries:
    """A stable identity for one series of a class, independent of its label."""

    id: int | None = None
    fund_registry_class_id: int
    name: str
    created_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class FundShareSeriesAlias:
    """A filing label confirmed to mean a series, between two filing dates.

    Both bounds are inclusive and either may be open (``None``).
    """

    id: int | None = None
    fund_share_series_id: int
    fund_registry_class_id: int
    label: str
    valid_from: date | None = None
    valid_to: date | None = None
    confirmed_at: datetime | None = None

    def applies_to(self, on: date) -> bool:
        return (self.valid_from is None or self.valid_from <= on) and (
            self.valid_to is None or on <= self.valid_to
        )

    def overlaps(self, other: FundShareSeriesAlias) -> bool:
        return (
            self.valid_from is None or other.valid_to is None or self.valid_from <= other.valid_to
        ) and (
            self.valid_to is None or other.valid_from is None or other.valid_from <= self.valid_to
        )


_WHITESPACE = re.compile(r'\s+')


def normalize_series_label(label: str) -> str:
    """Case, accents and whitespace only. "Série 1" and "Serie  1" are one label;
    "Série 1" and "Subclasse 1" are not, until someone confirms it."""
    decomposed = unicodedata.normalize('NFKD', label)
    stripped = ''.join(char for char in decomposed if not unicodedata.combining(char))
    return _WHITESPACE.sub(' ', stripped).strip().casefold()


def digits(value: str | None) -> str:
    """A CNPJ or CPF as digits only. The files format it both ways."""
    return re.sub(r'\D', '', value or '')
