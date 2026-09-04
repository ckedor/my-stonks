"""A leitura do PDF encontra, ou não encontra, o ativo no catálogo."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ValidationError
from app.modules.research.domain.draft import PositionMatch
from app.modules.research.domain.extraction import (
    ExtractedPosition,
    ExtractedRecommendedPortfolio,
)
from app.modules.research.service.recommended_portfolio_extraction_service import (
    MAX_PDF_BYTES,
    RecommendedPortfolioExtractionService,
)
from tests.fakes import FakeUnitOfWork

PDF = b'%PDF-1.7 relatorio'


class FakeExtractor:
    def __init__(self, extracted):
        self.extracted = extracted
        self.calls = []

    async def extract(self, *, filename, content):
        self.calls.append((filename, content))
        return self.extracted, 'gpt-4o'


def asset(id, ticker, name):
    return SimpleNamespace(id=id, ticker=ticker, name=name)


def extracted(*positions, **header):
    return ExtractedRecommendedPortfolio(positions=list(positions), **header)


def position(ticker, weight=10.0, **kwargs):
    return ExtractedPosition(ticker=ticker, weight=weight, **kwargs)


def build_service(extraction, assets):
    uow = FakeUnitOfWork(assets=SimpleNamespace(get_by_tickers=AsyncMock(return_value=assets)))
    service = RecommendedPortfolioExtractionService(uow, FakeExtractor(extraction))
    return service, uow


async def test_links_each_ticker_to_the_registered_asset():
    service, uow = build_service(
        extracted(position('XPML11', 12.5), position('KNCR11', 7.5), title='Carteira de FIIs'),
        [asset(42, 'XPML11', 'XP Malls'), asset(43, 'KNCR11', 'Kinea Rendimentos')],
    )

    draft = await service.extract(filename='btg.pdf', content=PDF)

    assert draft.title == 'Carteira de FIIs'
    assert [(p.ticker, p.asset_id, p.match) for p in draft.positions] == [
        ('XPML11', 42, PositionMatch.MATCHED),
        ('KNCR11', 43, PositionMatch.MATCHED),
    ]
    assert draft.positions[0].asset_name == 'XP Malls'
    assert draft.model == 'gpt-4o'
    # Uma consulta só para a carteira inteira, com os tickers sem repetição.
    uow.assets.get_by_tickers.assert_awaited_once_with(['KNCR11', 'XPML11'])


async def test_keeps_the_line_whose_ticker_the_catalogue_does_not_carry():
    """Descartá-la mudaria em silêncio o peso das que ficaram."""
    service, _ = build_service(
        extracted(position('XPML11', 60.0), position('NOVO11', 40.0)),
        [asset(42, 'XPML11', 'XP Malls')],
    )

    draft = await service.extract(filename='btg.pdf', content=PDF)

    novo = draft.positions[1]
    assert (novo.ticker, novo.asset_id, novo.match) == ('NOVO11', None, PositionMatch.UNKNOWN)
    assert draft.total_weight == 100.0


async def test_does_not_choose_between_two_assets_with_the_same_ticker():
    service, _ = build_service(
        extracted(position('BOVA11', 10.0)),
        [asset(7, 'BOVA11', 'iShares Ibovespa'), asset(8, 'BOVA11', 'BOVA11 duplicado')],
    )

    draft = await service.extract(filename='btg.pdf', content=PDF)

    (bova,) = draft.positions
    assert bova.match is PositionMatch.AMBIGUOUS
    assert bova.asset_id is None


async def test_sums_the_weights_as_they_were_read():
    """Não é regra, é fato: 97% pode ser linha perdida ou caixa na carteira."""
    service, _ = build_service(
        extracted(position('XPML11', 50.0), position('KNCR11', 47.0)),
        [],
    )

    draft = await service.extract(filename='btg.pdf', content=PDF)

    assert draft.total_weight == 97.0


@pytest.mark.parametrize(
    ('content', 'motivo'),
    [
        (b'', 'vazio'),
        (b'PK\x03\x04 isto e um zip', 'não é PDF'),
        (b'%PDF-' + b'x' * MAX_PDF_BYTES, 'grande demais'),
    ],
)
async def test_refuses_a_file_the_provider_could_not_read(content, motivo):
    """A recusa chega como recusa, e não como falha de integração."""
    service, _ = build_service(extracted(), [])

    with pytest.raises(ValidationError):
        await service.extract(filename='btg.pdf', content=content)

    assert service.extractor.calls == [], motivo
