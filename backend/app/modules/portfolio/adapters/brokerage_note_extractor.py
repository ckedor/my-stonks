from pydantic import ValidationError

from app.infra.ai.provider import (
    AIFileInput,
    AIGenerationRequest,
    AIProvider,
    TraceContext,
)
from app.infra.exceptions import IntegrationBadResponse
from app.modules.portfolio.domain.outputs import BrokerageNotesReading
from app.modules.portfolio.domain.prompts import build_brokerage_note_extraction_prompt

PROVIDER = 'brokerage_note_extraction'

PDF_MEDIA_TYPE = 'application/pdf'

#: Uma nota é uma tabela densa de números, e um número trocado de linha é uma
#: operação errada gravada. O modelo barato do provedor serve a respostas curtas.
#: Tem de ser de um provedor com chave: um modelo sem dono na cadeia de fallback
#: cai no padrão do primeiro provedor — foi assim que `claude-sonnet-5`, sem
#: chave da Anthropic, virou `gpt-4o-mini` e leu "XPML11 CI ER" sem o código.
EXTRACTION_MODEL = 'gpt-4o'


class BrokerageNoteExtractor:
    """Transforma o PDF de uma nota de corretagem na leitura das suas linhas.

    O PDF vai ao modelo como documento, como na extração do research: a tabela
    de negócios em texto extraído chega com as colunas embaralhadas.
    """

    def __init__(self, provider: AIProvider, model: str = EXTRACTION_MODEL):
        self.provider = provider
        self.model = model

    async def extract(self, *, filename: str, content: bytes) -> tuple[BrokerageNotesReading, str]:
        prompt = build_brokerage_note_extraction_prompt()
        result = await self.provider.generate(
            AIGenerationRequest(
                prompt=prompt.prompt,
                system=prompt.system,
                model=self.model,
                temperature=prompt.temperature,
                max_output_tokens=prompt.max_tokens,
                files=(AIFileInput(filename=filename, media_type=PDF_MEDIA_TYPE, content=content),),
                output_schema=BrokerageNotesReading,
                trace=TraceContext(label=PROVIDER),
            )
        )
        return self._parse(result.text), result.model

    @staticmethod
    def _parse(text: str) -> BrokerageNotesReading:
        try:
            return BrokerageNotesReading.model_validate_json(text)
        except ValidationError as error:
            raise IntegrationBadResponse(
                provider=PROVIDER,
                context={'reason': 'a resposta do modelo não tem o formato de uma nota'},
            ) from error
