from app.modules.ai.domain.feature_keys import AIFeatureKey
from app.modules.ai.service.handlers.asset_overview_and_news import (
    AssetOverviewAndNewsHandler,
)
from app.modules.ai.service.handlers.base import AIArtifactHandler, AIResponse

ARTIFACT_HANDLERS: dict[AIFeatureKey, type[AIArtifactHandler]] = {
    AssetOverviewAndNewsHandler.feature_key: AssetOverviewAndNewsHandler,
}

__all__ = ['ARTIFACT_HANDLERS', 'AIArtifactHandler', 'AIResponse']
