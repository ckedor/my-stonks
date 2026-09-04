"""Guardar uma carteira teórica: ela é de quem a montou, e o nome é único."""

import pytest

from app.core.exceptions import AlreadyExistsError, NotFoundError, ValidationError
from app.modules.lab.domain.commands import (
    SaveTheoreticalPortfolioCommand,
    TheoreticalPositionCommand,
)
from app.modules.lab.domain.entities import TheoreticalPortfolio
from app.modules.lab.domain.enums import Frequency
from app.modules.lab.service.theoretical_portfolio_service import (
    TheoreticalPortfolioService,
)
from app.modules.market_data.domain.constants import ASSET_FIXED_INCOME_TYPE
from tests.fakes import FakeUnitOfWork


class FakeRepository:
    """Só o que este serviço usa: buscar por filtro, criar e apagar."""

    def __init__(self, stored=()):
        self.stored = list(stored)
        self.deleted = []
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

    async def create(self, _model, data):
        for item in data:
            item.id = self.next_id
            self.next_id += 1
            self.stored.append(item)
        return [item.id for item in data]

    async def delete(self, model, id=None, **_kwargs):
        self.deleted.append(id)
        self.stored = [
            item for item in self.stored if not (isinstance(item, model) and item.id == id)
        ]


def command(**overrides):
    base = {
        'name': 'Minha teórica',
        'initial_amount': 10000.0,
        'contribution_amount': 1000.0,
        'contribution_frequency': Frequency.MONTHLY,
        'rebalance_frequency': Frequency.ANNUAL,
        'positions': [
            TheoreticalPositionCommand(asset_id=42, weight=60.0),
            TheoreticalPositionCommand(
                series_id=3,
                fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.PERC_INDEX,
                rate=1.10,
                label='110% do CDI',
                weight=40.0,
            ),
        ],
    }
    return SaveTheoreticalPortfolioCommand(**(base | overrides))


def build_service(stored=()):
    repository = FakeRepository(stored)
    uow = FakeUnitOfWork(repository=repository)
    return TheoreticalPortfolioService(uow), uow, repository


class TestCreate:
    async def test_keeps_the_parameters_and_the_lines(self):
        service, uow, _ = build_service()
        saved = await service.create(command(), user_id=7)

        assert saved.user_id == 7
        assert saved.name == 'Minha teórica'
        assert saved.contribution_frequency is Frequency.MONTHLY
        assert saved.rebalance_frequency is Frequency.ANNUAL
        assert [position.weight for position in saved.positions] == [60.0, 40.0]
        uow.commit.assert_awaited_once()

    async def test_an_asset_line_and_a_synthetic_line_live_side_by_side(self):
        service, _, _ = build_service()
        saved = await service.create(command(), user_id=7)

        asset_line, synthetic_line = saved.positions
        assert asset_line.is_asset
        assert not asset_line.is_fixed_income
        assert synthetic_line.is_fixed_income
        assert synthetic_line.label == '110% do CDI'

    async def test_the_same_name_twice_is_refused(self):
        """Duas carteiras homônimas na lista não dizem qual é qual."""
        existing = TheoreticalPortfolio(id=1, user_id=7, name='Minha teórica')
        service, _, _ = build_service([existing])

        with pytest.raises(AlreadyExistsError, match='Minha teórica'):
            await service.create(command(), user_id=7)

    async def test_another_user_may_use_the_same_name(self):
        existing = TheoreticalPortfolio(id=1, user_id=99, name='Minha teórica')
        service, _, _ = build_service([existing])

        saved = await service.create(command(), user_id=7)
        assert saved.user_id == 7


class TestValidation:
    async def test_a_portfolio_with_no_line_is_refused(self):
        service, _, _ = build_service()
        with pytest.raises(ValidationError, match='pelo menos uma linha'):
            await service.create(command(positions=[]), user_id=7)

    async def test_a_negative_weight_is_refused(self):
        """Venda a descoberto não é coisa que o laboratório simule."""
        service, _, _ = build_service()
        positions = [TheoreticalPositionCommand(asset_id=1, weight=-10.0)]
        with pytest.raises(ValidationError, match='negativo'):
            await service.create(command(positions=positions), user_id=7)

    async def test_the_same_asset_twice_is_refused(self):
        service, _, _ = build_service()
        positions = [
            TheoreticalPositionCommand(asset_id=42, weight=30.0),
            TheoreticalPositionCommand(asset_id=42, weight=30.0),
        ]
        with pytest.raises(ValidationError, match='mais de uma vez'):
            await service.create(command(positions=positions), user_id=7)

    async def test_a_line_without_an_asset_needs_a_rate(self):
        service, _, _ = build_service()
        positions = [TheoreticalPositionCommand(series_id=3, weight=100.0, rate=None)]
        with pytest.raises(ValidationError, match='tipo de rentabilidade'):
            await service.create(command(positions=positions), user_id=7)

    async def test_weights_need_not_sum_to_one_hundred(self):
        """Somar 100 é assunto da tela, não do banco.

        Quem monta uma carteira mexe num peso de cada vez, e recusar o estado
        intermediário impediria salvar um rascunho. O motor normaliza.
        """
        service, _, _ = build_service()
        positions = [
            TheoreticalPositionCommand(asset_id=1, weight=30.0),
            TheoreticalPositionCommand(asset_id=2, weight=40.0),
        ]
        saved = await service.create(command(positions=positions), user_id=7)
        assert sum(position.weight for position in saved.positions) == 70.0


class TestOwnership:
    async def test_reading_another_users_portfolio_says_it_does_not_exist(self):
        """Quem não é dono não deveria descobrir que o id existe."""
        theirs = TheoreticalPortfolio(id=1, user_id=99, name='Deles')
        service, _, _ = build_service([theirs])

        with pytest.raises(NotFoundError):
            await service.get(1, user_id=7)

    async def test_deleting_another_users_portfolio_is_refused(self):
        theirs = TheoreticalPortfolio(id=1, user_id=99, name='Deles')
        service, _, repository = build_service([theirs])

        with pytest.raises(NotFoundError):
            await service.delete(1, user_id=7)
        assert repository.deleted == []

    async def test_listing_only_returns_the_users_own(self):
        service, _, repository = build_service([
            TheoreticalPortfolio(id=1, user_id=7, name='Minha'),
            TheoreticalPortfolio(id=2, user_id=99, name='Deles'),
        ])
        found = await service.list(user_id=7)
        assert [item.name for item in found] == ['Minha']


class TestUpdate:
    async def test_replaces_the_whole_line_list(self):
        """A lista chega completa e substitui a anterior.

        Quem edita pesos mexe em vários de uma vez para a soma continuar
        fechando; mandar o estado final evita a tela ter de descobrir o diff.
        """
        existing = TheoreticalPortfolio(id=1, user_id=7, name='Minha teórica')
        service, uow, _ = build_service([existing])

        positions = [TheoreticalPositionCommand(asset_id=9, weight=100.0)]
        updated = await service.update(1, command(positions=positions), user_id=7)

        assert [position.asset_id for position in updated.positions] == [9]
        uow.commit.assert_awaited_once()

    async def test_keeping_its_own_name_is_not_a_duplicate(self):
        existing = TheoreticalPortfolio(id=1, user_id=7, name='Minha teórica')
        service, _, _ = build_service([existing])

        updated = await service.update(1, command(), user_id=7)
        assert updated.name == 'Minha teórica'

    async def test_taking_another_portfolios_name_is_refused(self):
        service, _, _ = build_service([
            TheoreticalPortfolio(id=1, user_id=7, name='Minha teórica'),
            TheoreticalPortfolio(id=2, user_id=7, name='Outra'),
        ])
        with pytest.raises(AlreadyExistsError):
            await service.update(2, command(name='Minha teórica'), user_id=7)


class TestPresets:
    def test_the_models_come_from_code_and_not_from_the_database(self):
        presets = TheoreticalPortfolioService.list_presets()
        assert {preset.key for preset in presets} >= {'cdi', '60-40', 'tripe-br'}

    def test_every_preset_sums_to_one_hundred(self):
        for preset in TheoreticalPortfolioService.list_presets():
            total = sum(line.weight for line in preset.lines)
            assert total == pytest.approx(100.0), preset.key

    def test_every_preset_line_is_a_market_series(self):
        """Um preset feito de tickers apodrece quando um ativo sai do catálogo."""
        for preset in TheoreticalPortfolioService.list_presets():
            for line in preset.lines:
                assert line.series_id is not None, preset.key
