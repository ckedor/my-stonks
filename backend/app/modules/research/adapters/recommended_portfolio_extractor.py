import json

from pydantic import ValidationError

from app.infra.exceptions import IntegrationBadResponse
from app.modules.ai.domain.provider import (
    AIFileInput,
    AIGenerationRequest,
    AIProvider,
)
from app.modules.research.domain.extraction import ExtractedRecommendedPortfolio
from app.modules.research.domain.prompts import build_recommended_portfolio_extraction_prompt

PROVIDER = 'recommended_portfolio_extraction'

PDF_MEDIA_TYPE = 'application/pdf'

#: The default model of the AI provider is chosen for short text answers. A
#: research report is a scanned or vector PDF read page by page, and the cheap
#: model reads its tables badly enough to shuffle weights between rows.
EXTRACTION_MODEL = 'gpt-4o'


class RecommendedPortfolioExtractor:
    """Turns a research PDF into the reading of a recommended portfolio.

    The PDF goes to the model as a document, not as text pulled out of it
    beforehand: the tables in these reports are the recommendation, and a text
    extraction of a two-column layout arrives with the tickers in one order and
    the weights in another.
    """

    def __init__(self, provider: AIProvider, model: str = EXTRACTION_MODEL):
        self.provider = provider
        self.model = model

    async def extract(
        self, *, filename: str, content: bytes
    ) -> tuple[ExtractedRecommendedPortfolio, str]:
        prompt = build_recommended_portfolio_extraction_prompt()
        result = await self.provider.generate(
            AIGenerationRequest(
                prompt=prompt.prompt,
                system=prompt.system,
                model=self.model,
                temperature=prompt.temperature,
                max_output_tokens=prompt.max_tokens,
                files=(
                    AIFileInput(
                        filename=filename,
                        media_type=PDF_MEDIA_TYPE,
                        content=content,
                    ),
                ),
                json_output=True,
            )
        )
        return self._parse(result.text), result.model

    @staticmethod
    def _parse(text: str) -> ExtractedRecommendedPortfolio:
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as error:
            raise IntegrationBadResponse(
                provider=PROVIDER,
                context={'reason': 'a resposta do modelo não é JSON'},
            ) from error
        if not isinstance(payload, dict):
            raise IntegrationBadResponse(
                provider=PROVIDER,
                context={'reason': 'a resposta do modelo não é um objeto JSON'},
            )
        try:
            return ExtractedRecommendedPortfolio.model_validate(payload)
        except ValidationError as error:
            raise IntegrationBadResponse(
                provider=PROVIDER,
                context={'reason': 'a resposta do modelo não tem o formato esperado'},
            ) from error
