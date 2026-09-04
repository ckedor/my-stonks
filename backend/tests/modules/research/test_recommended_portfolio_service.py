"""Guardar uma carteira recomendada: a casa é resolvida, a edição é única."""

from datetime import date
from types import SimpleNamespace

import pytest

from app.core.exceptions import AlreadyExistsError
from app.modules.research.domain.commands import (
    SaveRecommendedPortfolioCommand,
    SaveRecommendedPositionCommand,
)
from app.modules.research.domain.entities import RecommendedPortfolio, ResearchSource
from app.modules.research.service.recommended_portfolio_service import (
    RecommendedPortfolioService,
)
from tests.fakes import FakeUnitOfWork


class FakeRepository:
    """Só o que este serviço usa: buscar por filtro e criar, dando id."""

    def __init__(self, stored=()):
        self.stored = list(stored)
        self.created = []
        self.next_id = 1

    async def get(self, model, id=None, by=None, first=False, **_kwargs):
        found = [
            item
            for item in self.stored
            if isinstance(item, model)
            and (id is None or item.id == id)
            and all(getattr(item, key) == value for key, value in (by or {}).items())
        ]
        if id is not None or first:
            return found[0] if found else None
        return found

    async def create(self, model, data):
        for item in data:
            item.id = self.next_id
            self.next_id += 1
            self.stored.append(item)
            self.created.append(item)
        return [item.id for item in data]


def command(**overrides):
    base = {
        'source_name': 'BTG Pactual',
        'title': 'Carteira Recomendada de FIIs',
        'reference_date': date(2026, 8, 1),
        'summary': 'Mês de juros em queda.',
        'objective': 'Renda mensal.',
        'positions': [
            SaveRecommendedPositionCommand(ticker='XPML11', asset_id=42, weight=60.0),
            SaveRecommendedPositionCommand(ticker='NOVO11', asset_id=None, weight=40.0),
        ],
    }
    return SaveRecommendedPortfolioCommand(**(base | overrides))


def build_service(stored=()):
    repository = FakeRepository(stored)
    uow = FakeUnitOfWork(repository=repository)
    return RecommendedPortfolioService(uow), uow, repository


async def test_creates_the_house_on_its_first_report():
    service, uow, repository = build_service()

    portfolio = await service.create(command())

    source = next(item for item in repository.created if isinstance(item, ResearchSource))
    assert (source.name, source.slug) == ('BTG Pactual', 'btg-pactual')
    assert portfolio.source_id == source.id
    assert [(p.ticker, p.asset_id) for p in portfolio.positions] == [
        ('XPML11', 42),
        ('NOVO11', None),
    ]
    uow.commit.assert_awaited_once()


@pytest.mark.parametrize('typed', ['btg pactual', 'BTG  Pactual', 'BTG Pactual'])
async def test_reuses_the_house_however_it_was_typed(typed):
    """Sem isso a mesma casa vira três linhas com um terço do histórico cada."""
    existing = ResearchSource(id=9, name='BTG Pactual', slug='btg-pactual')
    service, _, repository = build_service([existing])

    portfolio = await service.create(command(source_name=typed))

    assert portfolio.source_id == 9
    assert not [item for item in repository.created if isinstance(item, ResearchSource)]


async def test_refuses_the_same_edition_twice():
    """Subir o mesmo PDF de novo é o engano fácil desta tela."""
    service, uow, _ = build_service([
        ResearchSource(id=9, name='BTG Pactual', slug='btg-pactual'),
        RecommendedPortfolio(
            id=3,
            source_id=9,
            title='Carteira Recomendada de FIIs',
            reference_date=date(2026, 8, 1),
        ),
    ])

    with pytest.raises(AlreadyExistsError):
        await service.create(command())

    uow.commit.assert_not_awaited()


async def test_the_same_carteira_in_another_month_is_another_edition():
    service, _, _ = build_service([
        ResearchSource(id=9, name='BTG Pactual', slug='btg-pactual'),
        RecommendedPortfolio(
            id=3,
            source_id=9,
            title='Carteira Recomendada de FIIs',
            reference_date=date(2026, 7, 1),
        ),
    ])

    portfolio = await service.create(command())

    assert portfolio.reference_date == date(2026, 8, 1)


async def test_lists_the_editions_most_recent_first():
    repository = SimpleNamespace(get=None)
    calls = []

    async def get(model, **kwargs):
        calls.append((model, kwargs))
        return []

    repository.get = get
    service = RecommendedPortfolioService(FakeUnitOfWork(repository=repository))

    await service.list()

    (model, kwargs) = calls[0]
    assert model is RecommendedPortfolio
    assert kwargs['order_by'] == 'reference_date desc'
    # Uma carteira sem as linhas dela é um título e uma data.
    assert kwargs['relations'] == ['positions']
