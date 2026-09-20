from fastapi import Depends

from app.infra.ai.factory import get_ai_provider
from app.infra.ai.provider import AIProvider
from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.modules.ai.domain.enums import AIFeatureKey
from app.modules.ai.service.ai_artifact_service import AIArtifactService
from app.modules.ai.service.ai_feature_service import AIFeatureService
from app.modules.ai.service.ai_prompt_service import AIPromptService
from app.modules.ai.service.ai_usage_service import AIUsageService
from app.modules.ai.service.handlers import AIFeatureHandler, AssetDescriptionDraftHandler
from app.modules.market_data.service.asset_service import AssetService
from app.modules.market_data.service.quote_service import PersistedQuoteReadService


def get_ai_feature_service(uow: UnitOfWork = Depends(get_uow)) -> AIFeatureService:
    return AIFeatureService(uow)


def get_ai_prompt_service(uow: UnitOfWork = Depends(get_uow)) -> AIPromptService:
    return AIPromptService(uow)


def get_ai_usage_service(uow: UnitOfWork = Depends(get_uow)) -> AIUsageService:
    return AIUsageService(uow)


def build_handlers() -> dict[AIFeatureKey, AIFeatureHandler]:
    """The handlers, wired to the read services that feed their prompts.

    This is the only place the AI module meets another module's services, and
    it is the reason a handler can state a real number: the import contract
    keeps `ai` away from other modules' repositories, so the data arrives as an
    injected reader rather than as a query written here.

    Each collaborator that talks to the database gets its **own** UnitOfWork —
    one instance cannot be entered twice, and a generation reads the registry
    and the quotes inside the same request.
    """
    return {
        AssetDescriptionDraftHandler.feature_key: AssetDescriptionDraftHandler(
            assets=AssetService(UnitOfWork()),
            quotes=PersistedQuoteReadService(UnitOfWork()),
        ),
    }


def get_ai_artifact_service(
    uow: UnitOfWork = Depends(get_uow),
    provider: AIProvider = Depends(get_ai_provider),
) -> AIArtifactService:
    return AIArtifactService(uow=uow, provider=provider, handlers=build_handlers())


def build_ai_artifact_service_for_task() -> AIArtifactService:
    """For the worker, which has no request-scoped UnitOfWork.

    It exists so no task has to import UnitOfWork, which is what the task
    import contract forbids.
    """
    return AIArtifactService(
        uow=UnitOfWork(),
        provider=get_ai_provider(),
        handlers=build_handlers(),
    )


def build_ai_handler_for_task(feature_key: str) -> AIFeatureHandler | None:
    """The handler alone, for the scheduled run that asks it what to refresh."""
    return build_handlers().get(feature_key)
