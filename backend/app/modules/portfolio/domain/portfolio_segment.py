"""Portfolio segments: the named subsets a specialized screen is about.

A segment answers "which part of the portfolio am I looking at" for a screen
that is about one kind of holding — the FIIs, the fixed income, the equity held
abroad. It is a read-side grouping: nothing is persisted per segment, and a
position belongs to exactly one segment, or to none.

Two things define a segment, and only two:

- the **asset types** it covers;
- whether it is the Brazilian or the foreign side of those types.

The second exists because the same type trades in both markets: a `STOCK` is a
B3 share or a Nasdaq one, and the two are different screens. The rule for which
side an asset is on is the exchange, and it is the one the provider adapter
already applies when it decides a quote's currency: B3 — or no exchange at all,
which is what a Brazilian instrument registered without one looks like — is the
Brazilian side, and anything else is abroad.

Segments do not have to cover the portfolio. Pension funds and investment funds
belong to no segment today, and a position outside every segment is simply not
on any specialized screen.
"""

from dataclasses import dataclass
from enum import StrEnum

from app.modules.market_data.domain.enums import EXCHANGE, AssetType


class PortfolioSegment(StrEnum):
    FII = 'fii'
    EQUITY_BR = 'equity-br'
    EQUITY_WORLD = 'equity-world'
    FIXED_INCOME = 'fixed-income'
    CRYPTO = 'crypto'


@dataclass(frozen=True, kw_only=True)
class SegmentDefinition:
    """What a segment is made of.

    ``brazilian_exchange`` is None when the exchange does not take part in the
    decision — an FII or a CDB has nowhere else to be.
    """

    asset_types: tuple[AssetType, ...]
    brazilian_exchange: bool | None = None

    @property
    def asset_type_names(self) -> tuple[str, ...]:
        return tuple(asset_type.value for asset_type in self.asset_types)

    @property
    def is_whole_asset_type(self) -> bool:
        """True when the segment is exactly one asset type, market included.

        Those are the segments the consolidated asset-type return series already
        answers, so they are read from it instead of being recomputed.
        """
        return len(self.asset_types) == 1 and self.brazilian_exchange is None


_EXCHANGE_TRADED = (AssetType.STOCK, AssetType.ETF, AssetType.BDR, AssetType.REIT)

SEGMENT_DEFINITIONS: dict[PortfolioSegment, SegmentDefinition] = {
    PortfolioSegment.FII: SegmentDefinition(asset_types=(AssetType.FII,)),
    PortfolioSegment.EQUITY_BR: SegmentDefinition(
        asset_types=_EXCHANGE_TRADED, brazilian_exchange=True
    ),
    PortfolioSegment.EQUITY_WORLD: SegmentDefinition(
        asset_types=_EXCHANGE_TRADED, brazilian_exchange=False
    ),
    PortfolioSegment.FIXED_INCOME: SegmentDefinition(
        asset_types=(
            AssetType.TREASURY,
            AssetType.CDB,
            AssetType.DEB,
            AssetType.CRI,
            AssetType.CRA,
            AssetType.LCA,
        )
    ),
    PortfolioSegment.CRYPTO: SegmentDefinition(asset_types=(AssetType.CRIPTO,)),
}


def get_segment_definition(segment: PortfolioSegment) -> SegmentDefinition:
    return SEGMENT_DEFINITIONS[PortfolioSegment(segment)]


def is_brazilian_exchange(exchange_code: str | None) -> bool:
    """Where an asset trades, reduced to the only distinction a segment makes.

    A missing exchange reads as Brazilian: it is how Treasury bonds, bank notes
    and every instrument that has no ticker on a foreign board are registered,
    and it is the same fallback the market-data provider applies when it decides
    such an asset is quoted in BRL.
    """
    return exchange_code is None or exchange_code == EXCHANGE.B3.value


def resolve_segment(asset_type_name: str | None, exchange_code: str | None) -> str | None:
    """The segment a position belongs to, or None when it belongs to none."""
    if not asset_type_name:
        return None

    for segment, definition in SEGMENT_DEFINITIONS.items():
        if asset_type_name not in definition.asset_type_names:
            continue
        if definition.brazilian_exchange is None:
            return segment.value
        if definition.brazilian_exchange is is_brazilian_exchange(exchange_code):
            return segment.value

    return None
