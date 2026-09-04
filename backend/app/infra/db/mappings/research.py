from sqlalchemy import inspect
from sqlalchemy.orm import relationship

from app.infra.db.base import Base
from app.infra.db.tables.research import (
    recommended_portfolio_table,
    recommended_position_table,
    research_source_table,
)
from app.modules.research.domain.entities import (
    RecommendedPortfolio,
    RecommendedPosition,
    ResearchSource,
)


def map_research() -> None:
    if inspect(ResearchSource, raiseerr=False) is not None:
        return
    Base.registry.map_imperatively(ResearchSource, research_source_table)
    Base.registry.map_imperatively(RecommendedPosition, recommended_position_table)
    Base.registry.map_imperatively(
        RecommendedPortfolio,
        recommended_portfolio_table,
        properties={
            'source': relationship(ResearchSource, lazy='joined'),
            # The lines are written and deleted with the edition they belong
            # to: a position without its portfolio is a weight of nothing.
            # There is no relationship back from the line, on purpose — the
            # repository nulls a foreign key whose relationship arrives unset,
            # and a line built inside its portfolio's list has no reason to
            # name the parent twice.
            'positions': relationship(
                RecommendedPosition,
                cascade='all, delete-orphan',
            ),
        },
    )
