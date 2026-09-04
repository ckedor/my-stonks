"""O PDF vai inteiro para o modelo, e a resposta dele não é confiável."""

import json
from dataclasses import dataclass

import pytest

from app.infra.exceptions import IntegrationBadResponse
from app.modules.ai.domain.provider import AIGenerationResult
from app.modules.research.adapters.recommended_portfolio_extractor import (
    EXTRACTION_MODEL,
    RecommendedPortfolioExtractor,
)
from app.modules.research.domain.enums import RecommendationChange

PDF = b'%PDF-1.7 conteudo'

ANSWER = {
    'source_name': 'BTG Pactual',
    'title': 'Carteira Recomendada de FIIs',
    'reference_date': '2026-08-01',
    'summary': 'Mês de juros em queda.',
    'objective': 'Renda mensal com FIIs de tijolo.',
    'positions': [
        {
            'ticker': 'xpml11 ',
            'name': 'XP Malls',
            'weight': '12,5%',
            'target_price': 'R$ 118,40',
            'rationale': 'Shoppings maduros.',
            'change': 'INCREASED',
        },
        {'ticker': 'KNCR11', 'weight': 7.5, 'change': 'aumentou muito'},
    ],
}


@dataclass
class FakeProvider:
    text: str

    def __post_init__(self):
        self.request = None

    async def generate(self, request):
        self.request = request
        return AIGenerationResult(text=self.text, model='gpt-4o')

    async def aclose(self):
        pass


async def test_sends_the_pdf_as_a_document_and_asks_for_json():
    provider = FakeProvider(json.dumps(ANSWER))

    extracted, model = await RecommendedPortfolioExtractor(provider).extract(
        filename='btg.pdf', content=PDF
    )

    assert model == 'gpt-4o'
    assert provider.request.model == EXTRACTION_MODEL
    assert provider.request.json_output is True
    # Transcrição, não redação: o mesmo PDF lido duas vezes tem que dar o mesmo peso.
    assert provider.request.temperature == 0.0
    (file,) = provider.request.files
    assert file.content == PDF
    assert file.media_type == 'application/pdf'
    assert extracted.title == 'Carteira Recomendada de FIIs'
    assert str(extracted.reference_date) == '2026-08-01'


async def test_normalizes_what_the_report_writes_by_hand():
    provider = FakeProvider(json.dumps(ANSWER))

    extracted, _ = await RecommendedPortfolioExtractor(provider).extract(
        filename='btg.pdf', content=PDF
    )

    xpml, kncr = extracted.positions
    assert xpml.ticker == 'XPML11'
    assert xpml.weight == 12.5
    assert xpml.target_price == 118.40
    assert xpml.change is RecommendationChange.INCREASED
    # Uma palavra fora da lista não é declaração nenhuma, e não derruba a leitura
    # inteira junto com os pesos.
    assert kncr.change is None


@pytest.mark.parametrize(
    'text',
    ['não é json', '[1, 2, 3]', '{"positions": [{"ticker": "XPML11"}]}'],
    ids=['texto solto', 'lista', 'linha sem peso'],
)
async def test_rejects_an_answer_it_cannot_read(text):
    extractor = RecommendedPortfolioExtractor(FakeProvider(text))

    with pytest.raises(IntegrationBadResponse):
        await extractor.extract(filename='btg.pdf', content=PDF)
