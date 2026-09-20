from datetime import datetime

from sqlalchemy import desc, func, select, update
from sqlalchemy.dialects.postgresql import insert

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.db.tables.ai import ai_artifact_table, ai_run_table
from app.modules.ai.domain.entities import AIArtifact, AIFeature, AIPromptVersion, AIRun


class AIRepository(SQLAlchemyRepository):
    async def list_features(self) -> list[AIFeature]:
        result = await self.session.execute(select(AIFeature).order_by(AIFeature.key))
        return list(result.unique().scalars().all())

    async def get_feature_by_key(self, key: str) -> AIFeature | None:
        result = await self.session.execute(select(AIFeature).where(AIFeature.key == key))
        return result.unique().scalar_one_or_none()

    async def get_feature(self, feature_id: int) -> AIFeature | None:
        result = await self.session.execute(select(AIFeature).where(AIFeature.id == feature_id))
        return result.unique().scalar_one_or_none()

    async def get_active_prompt_version(self, feature_id: int) -> AIPromptVersion | None:
        result = await self.session.execute(
            select(AIPromptVersion).where(
                AIPromptVersion.feature_id == feature_id,
                AIPromptVersion.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_prompt_version(self, version_id: int) -> AIPromptVersion | None:
        result = await self.session.execute(
            select(AIPromptVersion).where(AIPromptVersion.id == version_id)
        )
        return result.scalar_one_or_none()

    async def list_prompt_versions(self, feature_id: int) -> list[AIPromptVersion]:
        result = await self.session.execute(
            select(AIPromptVersion)
            .where(AIPromptVersion.feature_id == feature_id)
            .order_by(desc(AIPromptVersion.version))
        )
        return list(result.scalars().all())

    async def next_prompt_version_number(self, feature_id: int) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.max(AIPromptVersion.version), 0)).where(
                AIPromptVersion.feature_id == feature_id
            )
        )
        return int(result.scalar_one()) + 1

    async def deactivate_prompt_versions(self, feature_id: int) -> None:
        """Clear the active flag before setting a new one.

        The partial unique index refuses two active versions, so activating one
        without clearing the other fails at the flush. Doing it in this order
        makes activation a two-statement operation inside one transaction.
        """
        await self.session.execute(
            update(AIPromptVersion)
            .where(AIPromptVersion.feature_id == feature_id, AIPromptVersion.is_active.is_(True))
            .values(is_active=False)
        )

    async def get_artifact(
        self, *, feature_id: int, prompt_version_id: int, input_hash: str
    ) -> AIArtifact | None:
        result = await self.session.execute(
            select(AIArtifact).where(
                AIArtifact.feature_id == feature_id,
                AIArtifact.prompt_version_id == prompt_version_id,
                AIArtifact.input_hash == input_hash,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_artifact(self, artifact: AIArtifact) -> AIArtifact:
        """Write the answer for (feature, prompt version, input), replacing any.

        A regeneration is an overwrite and not a second row: the identity of an
        artifact is what produced it, so there is exactly one answer per triple.
        The history that matters — what the previous prompt version answered —
        lives in the rows of the other versions, which this never touches.
        """
        values = {
            'feature_id': artifact.feature_id,
            'prompt_version_id': artifact.prompt_version_id,
            'input_hash': artifact.input_hash,
            'input': artifact.input,
            'payload': artifact.payload,
            'schema_version': artifact.schema_version,
            'model': artifact.model,
            'generated_at': artifact.generated_at,
            'expires_at': artifact.expires_at,
        }
        statement = (
            insert(ai_artifact_table)
            .values(**values)
            .on_conflict_do_update(
                constraint='uq_ai_artifact_identity',
                set_={
                    'input': values['input'],
                    'payload': values['payload'],
                    'schema_version': values['schema_version'],
                    'model': values['model'],
                    'generated_at': values['generated_at'],
                    'expires_at': values['expires_at'],
                },
            )
            .returning(ai_artifact_table.c.id)
        )
        result = await self.session.execute(statement)
        artifact.id = result.scalar_one()
        return artifact

    async def record_run(self, run: AIRun) -> None:
        await self.session.execute(
            insert(ai_run_table).values(
                feature_id=run.feature_id,
                prompt_version_id=run.prompt_version_id,
                label=run.label,
                provider=run.provider,
                model=run.model,
                input_tokens=run.input_tokens,
                output_tokens=run.output_tokens,
                cost_usd=run.cost_usd,
                latency_ms=run.latency_ms,
                status=run.status,
                error=run.error,
                trace_id=run.trace_id,
            )
        )

    async def cost_since(self, moment: datetime) -> float:
        result = await self.session.execute(
            select(func.coalesce(func.sum(AIRun.cost_usd), 0.0)).where(AIRun.created_at >= moment)
        )
        return float(result.scalar_one())

    async def recent_runs(self, limit: int = 100) -> list[AIRun]:
        result = await self.session.execute(
            select(AIRun).order_by(desc(AIRun.created_at)).limit(limit)
        )
        return list(result.scalars().all())

    async def usage_by_day(self, since: datetime) -> list[dict]:
        day = func.date_trunc('day', AIRun.created_at).label('day')
        result = await self.session.execute(
            select(
                day,
                AIRun.label,
                AIRun.model,
                func.count().label('runs'),
                func.sum(AIRun.input_tokens).label('input_tokens'),
                func.sum(AIRun.output_tokens).label('output_tokens'),
                func.sum(AIRun.cost_usd).label('cost_usd'),
            )
            .where(AIRun.created_at >= since)
            .group_by(day, AIRun.label, AIRun.model)
            .order_by(desc(day))
        )
        return [dict(row._mapping) for row in result]
