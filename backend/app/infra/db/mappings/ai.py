from sqlalchemy import inspect
from sqlalchemy.orm import relationship

from app.infra.db.base import Base
from app.infra.db.tables.ai import (
    ai_artifact_table,
    ai_feature_table,
    ai_prompt_version_table,
    ai_run_table,
)
from app.modules.ai.domain.entities import (
    AIArtifact,
    AIFeature,
    AIPromptVersion,
    AIRun,
)


def map_ai() -> None:
    if inspect(AIFeature, raiseerr=False) is not None:
        return
    Base.registry.map_imperatively(AIRun, ai_run_table)
    Base.registry.map_imperatively(AIPromptVersion, ai_prompt_version_table)
    Base.registry.map_imperatively(AIArtifact, ai_artifact_table)
    Base.registry.map_imperatively(
        AIFeature,
        ai_feature_table,
        # `created_at` e `updated_at` são gerados pelo banco. Sem buscá-los na
        # mesma instrução, o SQLAlchemy os deixa expirados depois do INSERT ou
        # do UPDATE, e quem serializa a entidade já fora do escopo da
        # transação tenta recarregá-los de uma sessão fechada.
        eager_defaults=True,
        properties={
            # Versions are read whenever a feature is: the generation needs the
            # active one, and the admin needs the history. There is no
            # relationship back from a version, for the same reason a
            # recommended position does not name its portfolio — the repository
            # nulls a foreign key whose relationship arrives unset.
            'prompt_versions': relationship(
                AIPromptVersion,
                cascade='all, delete-orphan',
                order_by=ai_prompt_version_table.c.version.desc(),
            ),
        },
    )
