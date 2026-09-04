"""Portfolio segments: the named subsets a specialized screen is about.

A segment answers "which part of the portfolio am I looking at" for a screen
that is about one kind of holding — the FIIs, the fixed income, the equity held
abroad. It is a read-side grouping: nothing is persisted per segment, and a
position belongs to exactly one segment, or to none.

Two things define a segment, and only two:

- the **asset types** it covers, by id;
- whether it is the Brazilian or the foreign side of those types.

The second exists because the same type trades in both markets: a stock is a B3
share or a Nasdaq one, and the two are different screens. The rule for which
side an asset is on is the exchange when the registry records one, and the
shape of the ticker when it does not. The exchange alone was not enough: most
of the registry carries none, so "no exchange means Brazilian" put every
American ETF — IVV, QQQM, SCHD — on the Brazilian equity screen.

Membership is by **id**, never by `asset_type.short_name`. That column holds
product copy in pt-BR — `Ação`, `Tesouro`, `Cripto`, `Debênture` — while the
codes in `docs/domain.md` are English. Matching the two silently worked for the
types whose label happens to equal its code (`FII`, `ETF`, `CDB`) and silently
failed for the rest, which is how the specialized screens came up empty. The id
is the seeded primary key and the only stable identity an asset type has.

Segments do not have to cover the portfolio. Pension and investment funds
belong to none, and a position outside every segment is simply not on any
specialized screen.

A segment's return series is persisted like any other scope of
``portfolio.return_series``, so reading one is a select. It was not always: the
segments that cut a type by market had no series and were recomputed on every
request, which is the asymmetry the unified table removed.
"""

from dataclasses import dataclass
from enum import StrEnum

from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.domain.market_scope import is_b3_ticker


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

    asset_types: tuple[ASSET_TYPE, ...]
    brazilian_exchange: bool | None = None

    @property
    def asset_type_ids(self) -> tuple[int, ...]:
        return tuple(int(asset_type) for asset_type in self.asset_types)


_EXCHANGE_TRADED = (ASSET_TYPE.STOCK, ASSET_TYPE.ETF, ASSET_TYPE.BDR, ASSET_TYPE.REIT)

SEGMENT_DEFINITIONS: dict[PortfolioSegment, SegmentDefinition] = {
    PortfolioSegment.FII: SegmentDefinition(asset_types=(ASSET_TYPE.FII,)),
    PortfolioSegment.EQUITY_BR: SegmentDefinition(
        asset_types=_EXCHANGE_TRADED, brazilian_exchange=True
    ),
    PortfolioSegment.EQUITY_WORLD: SegmentDefinition(
        asset_types=_EXCHANGE_TRADED, brazilian_exchange=False
    ),
    PortfolioSegment.FIXED_INCOME: SegmentDefinition(
        asset_types=(
            ASSET_TYPE.TREASURY,
            ASSET_TYPE.CDB,
            ASSET_TYPE.DEB,
            ASSET_TYPE.CRI,
            ASSET_TYPE.CRA,
            ASSET_TYPE.LCA,
        )
    ),
    PortfolioSegment.CRYPTO: SegmentDefinition(asset_types=(ASSET_TYPE.CRIPTO,)),
}

#: Asset types that belong to no specialized screen, listed on purpose so that
#: "has no segment" is a decision and not an omission.
UNSEGMENTED_ASSET_TYPES = (ASSET_TYPE.PREV, ASSET_TYPE.FI)


def get_segment_definition(segment: PortfolioSegment) -> SegmentDefinition:
    return SEGMENT_DEFINITIONS[PortfolioSegment(segment)]


def is_brazilian_exchange(exchange_code: str | None, ticker: str | None = None) -> bool:
    """Where an asset trades, reduced to the only distinction a segment makes.

    The exchange answers it when the registry has one. When it does not, the
    ticker answers instead, and that second step is not a refinement — it is
    what makes the rule correct at all. Most of the registry has no exchange:
    a missing one was read as Brazilian, which is right for a Treasury bond or
    a bank note, and wrong for IVV, QQQM and SCHD, which came in without an
    exchange like everything else and landed on the Brazilian equity screen.

    The ticker format is the B3's own rule and no American ticker matches it —
    see ``market_data.domain.market_scope``. It is only consulted when there is
    no exchange, so an asset the registry does place on a board is still
    decided by the board.
    """
    if exchange_code is not None:
        return exchange_code == EXCHANGE.B3.value
    # Sem ticker não há segundo critério, e o padrão continua sendo brasileiro:
    # é assim que o Tesouro e o CDB, que não têm código em bolsa nenhuma, são
    # registrados.
    return ticker is None or is_b3_ticker(ticker)


def resolve_segment(
    asset_type_id: int | None,
    exchange_code: str | None,
    ticker: str | None = None,
) -> str | None:
    """The segment a position belongs to, or None when it belongs to none."""
    if asset_type_id is None:
        return None

    asset_type_id = int(asset_type_id)

    for segment, definition in SEGMENT_DEFINITIONS.items():
        if asset_type_id not in definition.asset_type_ids:
            continue
        if definition.brazilian_exchange is None:
            return segment.value
        if definition.brazilian_exchange is is_brazilian_exchange(exchange_code, ticker):
            return segment.value

    return None
