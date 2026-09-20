from app.core.exceptions import NotFoundError, ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.ai.domain.commands import UpdateAIFeatureCommand
from app.modules.ai.domain.entities import AIFeature
from app.modules.ai.domain.enums import AIFreshness
from app.modules.ai.service.handlers import HANDLER_CLASSES


class AIFeatureService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def list(self) -> list[AIFeature]:
        async with self.uow as uow:
            return await uow.ai.list_features()

    async def get(self, feature_key: str) -> AIFeature:
        async with self.uow as uow:
            feature = await uow.ai.get_feature_by_key(feature_key)
        if feature is None:
            raise NotFoundError(f'A feature de IA "{feature_key}" não está cadastrada')
        return feature

    async def update(self, command: UpdateAIFeatureCommand) -> AIFeature:
        self._assert_freshness_is_coherent(command)
        async with self.uow as uow:
            feature = await uow.ai.get_feature_by_key(command.feature_key)
            if feature is None:
                raise NotFoundError(f'A feature de IA "{command.feature_key}" não está cadastrada')
            feature.name = command.name
            feature.description = command.description
            feature.enabled = command.enabled
            feature.freshness = command.freshness
            feature.ttl_hours = command.ttl_hours
            await uow.commit()
            return feature

    @staticmethod
    def input_schema(feature_key: str) -> dict:
        """The JSON Schema of a feature's input.

        It is what lets the admin build a run form for a feature it has never
        heard of: the shape is declared once, on the handler, and the screen
        reads it instead of being written per feature.
        """
        handler = HANDLER_CLASSES.get(feature_key)
        if handler is None:
            raise NotFoundError(f'A feature de IA "{feature_key}" não tem handler')
        return handler.input_model.model_json_schema()

    @staticmethod
    def _assert_freshness_is_coherent(command: UpdateAIFeatureCommand) -> None:
        if command.freshness not in tuple(AIFreshness):
            raise ValidationError(
                f'Validade inválida: {command.freshness}. Use uma de: {", ".join(AIFreshness)}'
            )
        if command.freshness == AIFreshness.TIME and not command.ttl_hours:
            raise ValidationError('Uma feature com validade por tempo precisa de um TTL em horas')
        if command.freshness == AIFreshness.MANUAL and command.ttl_hours is not None:
            raise ValidationError(
                'Uma feature de validade manual não tem TTL: a resposta só sai por refresh'
            )
