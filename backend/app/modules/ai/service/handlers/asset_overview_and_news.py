from app.modules.ai.domain.feature_keys import AIFeatureKey
from app.modules.ai.domain.inputs import AssetOverviewAndNewsInput
from app.modules.ai.domain.prompts import build_asset_overview_and_news_prompt
from app.modules.ai.domain.provider import AIGenerationRequest
from app.modules.ai.service.handlers.base import AIArtifactHandler, AIResponse


class AssetOverviewAndNewsHandler(AIArtifactHandler[AssetOverviewAndNewsInput]):
    feature_key = AIFeatureKey.ASSET_OVERVIEW_AND_NEWS
    input_schema = AssetOverviewAndNewsInput

    async def generate(self, input: AssetOverviewAndNewsInput) -> AIResponse:
        prompt = build_asset_overview_and_news_prompt(ticker=input.ticker)
        result = await self.provider.generate(
            AIGenerationRequest(
                prompt=prompt.prompt,
                system=prompt.system,
                temperature=prompt.temperature,
                max_output_tokens=prompt.max_tokens,
            )
        )
        return AIResponse(
            summary=prompt.summary,
            payload={'text': result.text},
            model=result.model,
        )
