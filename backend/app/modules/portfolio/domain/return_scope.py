"""What a persisted return series is about.

A portfolio's performance is read at four altitudes -- the whole portfolio, one
of the user's custom categories, one asset type, one portfolio segment -- and
the arithmetic is the same at every one of them: each position weighs by what it
was worth the day before, and the weighted returns are summed per day. Only the
grouping key changes.

So there is one series table, and this is the discriminator. ``scope`` says which
altitude a row is about and ``scope_key`` says which one of them, as text because
the four keys are not the same kind of thing: a category id, an asset-type id, a
segment code, and -- for the portfolio itself -- nothing at all.

The price of one table is that ``scope_key`` cannot be a foreign key: it points
at three different tables depending on the row. Deleting a category or a
portfolio therefore has to delete its series explicitly, the way the portfolio
delete already clears positions and transactions by hand.
"""

from enum import StrEnum

from app.modules.portfolio.domain.portfolio_segment import PortfolioSegment

#: What ``scope_key`` holds for a series about the whole portfolio. Empty string
#: and not NULL: Postgres treats NULLs as distinct, so a nullable key would let
#: the unique constraint accept the same portfolio-wide day twice.
WHOLE_PORTFOLIO_KEY = ''


class ReturnScope(StrEnum):
    PORTFOLIO = 'portfolio'
    CATEGORY = 'category'
    ASSET_TYPE = 'asset_type'
    SEGMENT = 'segment'


def category_key(custom_category_id: int) -> str:
    return str(custom_category_id)


def asset_type_key(asset_type_id: int) -> str:
    return str(asset_type_id)


def segment_key(segment: PortfolioSegment) -> str:
    return str(segment)
