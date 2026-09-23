from pydantic import ValidationError

from app.infra.ai.provider import AIFileInput, AIGenerationRequest, AIProvider, TraceContext
from app.infra.exceptions import IntegrationBadResponse
from app.modules.portfolio.adapters.brokerage_note_extractor import (
    EXTRACTION_MODEL,
    PDF_MEDIA_TYPE,
)
from app.modules.portfolio.domain.outputs import PositionStatementReading
from app.modules.portfolio.domain.prompts import build_position_statement_prompt

PROVIDER = 'position_statement_extraction'


class PositionStatementExtractor:
    """Transforma o PDF de um extrato de corretora na posição que ele mostra."""

    def __init__(self, provider: AIProvider, model: str = EXTRACTION_MODEL):
        self.provider = provider
        self.model = model

    async def extract(
        self, *, filename: str, content: bytes
    ) -> tuple[PositionStatementReading, str]:
        prompt = build_position_statement_prompt()
        result = await self.provider.generate(
            AIGenerationRequest(
                prompt=prompt.prompt,
                system=prompt.system,
                model=self.model,
                temperature=prompt.temperature,
                max_output_tokens=prompt.max_tokens,
                files=(AIFileInput(filename=filename, media_type=PDF_MEDIA_TYPE, content=content),),
                output_schema=PositionStatementReading,
                trace=TraceContext(label=PROVIDER),
            )
        )
        try:
            return PositionStatementReading.model_validate_json(result.text), result.model
        except ValidationError as error:
            raise IntegrationBadResponse(
                provider=PROVIDER,
                context={'reason': 'a resposta do modelo não tem o formato de um extrato'},
            ) from error
