from sqlalchemy import inspect
from sqlalchemy.orm import relationship

from app.infra.db.base import Base
from app.infra.db.tables.ai import ai_artifact_table, ai_feature_table
from app.modules.ai.domain.entities import AIArtifact, AIFeature


def map_ai() -> None:
    if inspect(AIFeature, raiseerr=False) is not None:
        return
    Base.registry.map_imperatively(AIFeature, ai_feature_table)
    Base.registry.map_imperatively(
        AIArtifact,
        ai_artifact_table,
        properties={'feature': relationship(AIFeature, lazy='joined')},
    )
