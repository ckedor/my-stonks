import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import AlreadyExistsError, NotFoundError, ValidationError
from app.modules.portfolio.domain.entities import (
    ConfigurationName,
    PortfolioUserConfiguration,
    WealthTier,
)
from app.modules.portfolio.service.portfolio_wealth_tier_service import (
    ARTWORK_SETTING,
    MAX_ARTWORK_BYTES,
    PortfolioWealthTierService,
)
from tests.fakes import FakeUnitOfWork

LADDER = [
    WealthTier(id=1, rank=1, name='Pedinte', threshold=0.0),
    WealthTier(id=2, rank=2, name='Andarilho', threshold=50_000.0),
    WealthTier(id=3, rank=3, name='Camponês', threshold=100_000.0),
    WealthTier(id=4, rank=4, name='Mercador', threshold=200_000.0),
]


def _build(evolution=None, tiers=None, artwork_enabled=False):
    """A service over a fixed ladder, a fixed patrimony series and a setting.

    `repository.get` answers by entity: the ladder for WealthTier, and the
    artwork setting for the two configuration entities.
    """
    ladder = list(LADDER if tiers is None else tiers)

    async def get(entity, **kwargs):
        if entity is ConfigurationName:
            return SimpleNamespace(id=7, name=ARTWORK_SETTING)
        if entity is PortfolioUserConfiguration:
            return SimpleNamespace(enabled=artwork_enabled)
        return ladder

    repository = SimpleNamespace(
        get=AsyncMock(side_effect=get),
        create=AsyncMock(),
        update=AsyncMock(),
        delete=AsyncMock(),
    )
    uow = FakeUnitOfWork(repository=repository)
    position_service = SimpleNamespace(get_patrimony_evolution=AsyncMock(return_value=evolution))
    service = PortfolioWealthTierService(uow=uow, position_service=position_service)
    return service, uow, repository, position_service


def _series(*values):
    return [{'date': f'2025-01-{i + 1:02d}', 'portfolio': v} for i, v in enumerate(values)]


@pytest.mark.asyncio
async def test_lists_the_ladder_lowest_rung_first():
    shuffled = [LADDER[2], LADDER[0], LADDER[3], LADDER[1]]
    service, *_ = _build(tiers=shuffled)

    tiers = await service.list_tiers()

    assert [tier.rank for tier in tiers] == [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_a_portfolio_at_its_peak_reads_the_same_either_way():
    service, *_ = _build(_series(10_000.0, 60_000.0, 120_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['peak_patrimony'] == 120_000.0
    assert standing['current_patrimony'] == 120_000.0
    assert standing['current_tier'].name == 'Camponês'
    assert standing['next_tier'].name == 'Mercador'
    assert standing['remaining'] == 80_000.0


@pytest.mark.asyncio
async def test_a_tier_survives_the_patrimony_falling_back_below_its_threshold():
    """The guard on the whole promise: a rung is reached once and never lost.

    The series peaks inside Camponês and then falls back under Andarilho. If the
    tier were ever read from the latest value instead of the peak, this is where
    it would regress, so the assertion is on the fallen series, not the peak.
    """
    service, *_ = _build(_series(10_000.0, 120_000.0, 30_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['peak_patrimony'] == 120_000.0
    assert standing['current_tier'].name == 'Camponês'


@pytest.mark.asyncio
async def test_what_is_left_to_climb_is_measured_from_today_not_from_the_peak():
    """The other half of the split, and the reason the two numbers both exist.

    The peak of 120k earns Camponês, but the carteira is worth 30k today. The
    distance to Mercador is the one the portfolio actually has to cover from
    where it stands — 170k, not the 80k it would owe from its high.
    """
    service, *_ = _build(_series(10_000.0, 120_000.0, 30_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_patrimony'] == 30_000.0
    assert standing['remaining'] == 170_000.0


@pytest.mark.asyncio
async def test_a_portfolio_below_its_own_rung_shows_an_empty_bar():
    """Falling under the floor of a rung already won is not negative progress."""
    service, *_ = _build(_series(120_000.0, 30_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_tier'].name == 'Camponês'
    assert standing['progress'] == 0.0


@pytest.mark.asyncio
async def test_an_empty_portfolio_sits_on_the_lowest_rung():
    service, *_ = _build(None)

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['peak_patrimony'] == 0.0
    assert standing['current_patrimony'] == 0.0
    assert standing['current_tier'].name == 'Pedinte'
    assert standing['next_tier'].name == 'Andarilho'
    assert standing['progress'] == 0.0


@pytest.mark.asyncio
async def test_the_top_rung_has_no_next_and_is_fully_progressed():
    service, *_ = _build(_series(500_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_tier'].name == 'Mercador'
    assert standing['next_tier'] is None
    assert standing['remaining'] is None
    assert standing['progress'] == 1.0


@pytest.mark.asyncio
async def test_progress_is_measured_across_the_current_rung_only():
    service, *_ = _build(_series(75_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    # Halfway from Andarilho (50k) to Camponês (100k), not 75% of the way to 100k.
    assert standing['progress'] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_the_peak_is_read_in_brl_whatever_the_user_is_looking_at():
    service, _, _, position_service = _build(_series(1.0))

    await service.get_portfolio_tier(portfolio_id=7)

    position_service.get_patrimony_evolution.assert_awaited_once_with(7, currency='BRL')


@pytest.mark.asyncio
async def test_gaps_in_the_series_do_not_break_the_reading():
    """A missing tail value must not read as a carteira worth nothing today."""
    service, *_ = _build([
        {'date': '2025-01-01', 'portfolio': 60_000.0},
        {'date': '2025-01-02', 'portfolio': None},
        {'date': '2025-01-03'},
    ])

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['peak_patrimony'] == 60_000.0
    assert standing['current_patrimony'] == 60_000.0


# ── Ladder CRUD ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_two_rungs_cannot_share_a_threshold():
    """An ambiguous ladder is read wrong exactly where it is read."""
    service, _, repository, _ = _build()
    repository.get = AsyncMock(return_value=LADDER[1])

    with pytest.raises(AlreadyExistsError):
        await service.create_tier(rank=9, name='Novo', threshold=50_000.0)


@pytest.mark.asyncio
async def test_updating_a_rung_does_not_collide_with_itself():
    service, uow, repository, _ = _build()
    repository.get = AsyncMock(return_value=LADDER[1])

    await service.update_tier(tier_id=2, name='Andarilho', threshold=50_000.0)

    uow.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_updating_a_missing_rung_is_not_found():
    service, _, repository, _ = _build()
    repository.get = AsyncMock(return_value=None)

    with pytest.raises(NotFoundError):
        await service.update_tier(tier_id=404, name='Fantasma')


# ── Artwork ──────────────────────────────────────────────────────

PNG_ARTWORK = 'data:image/png;base64,iVBORw0KGgp4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4'
SVG_ARTWORK = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiLz48L3N2Zz4='
SVG_WITH_SCRIPT = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4='
SVG_WITH_HANDLER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIG9ubG9hZD0iYWxlcnQoMSkiLz4='


@pytest.mark.parametrize(
    'artwork',
    [pytest.param(PNG_ARTWORK, id='png'), pytest.param(SVG_ARTWORK, id='svg')],
)
@pytest.mark.asyncio
async def test_accepts_raster_and_vector_artwork(artwork):
    """Pixel art is raster by nature, so PNG is a first-class choice here."""
    service, _, repository, _ = _build()
    repository.get = AsyncMock(return_value=None)

    await service.create_tier(rank=9, name='Novo', threshold=9_000.0, artwork=artwork)

    assert repository.create.await_args.args[1]['artwork'] == artwork


@pytest.mark.parametrize(
    'artwork',
    [
        pytest.param(SVG_WITH_SCRIPT, id='script-tag'),
        pytest.param(SVG_WITH_HANDLER, id='event-handler'),
    ],
)
@pytest.mark.asyncio
async def test_rejects_executable_svg(artwork):
    """Proves the guard still fires, since the column outlives its reader.

    Today the card renders every artwork through an `<img>`, where none of this
    would run. The check is what keeps that from being load-bearing.
    """
    service, *_ = _build()

    with pytest.raises(ValidationError):
        await service.create_tier(rank=9, name='Novo', threshold=9_000.0, artwork=artwork)


@pytest.mark.asyncio
async def test_rejects_a_file_type_that_is_not_an_image():
    service, *_ = _build()
    pdf = 'data:application/pdf;base64,' + base64.b64encode(b'%PDF-1.4').decode()

    with pytest.raises(ValidationError):
        await service.create_tier(rank=9, name='Novo', threshold=9_000.0, artwork=pdf)


@pytest.mark.asyncio
async def test_rejects_something_that_is_not_a_data_uri():
    """A raw path or storage key is exactly what this column must never hold."""
    service, *_ = _build()

    with pytest.raises(ValidationError):
        await service.create_tier(
            rank=9, name='Novo', threshold=9_000.0, artwork='/static/cavaleiro.png'
        )


@pytest.mark.asyncio
async def test_rejects_a_broken_payload():
    service, *_ = _build()

    with pytest.raises(ValidationError):
        await service.create_tier(
            rank=9, name='Novo', threshold=9_000.0, artwork='data:image/png;base64,!!!!'
        )


@pytest.mark.asyncio
async def test_rejects_an_oversized_illustration():
    service, *_ = _build()
    oversized = 'data:image/png;base64,' + 'A' * MAX_ARTWORK_BYTES

    with pytest.raises(ValidationError):
        await service.create_tier(rank=9, name='Novo', threshold=9_000.0, artwork=oversized)


@pytest.mark.asyncio
async def test_artwork_can_be_removed():
    """The "Remover" button sends an empty string, and it has to mean something.

    Empty normalises to None, which is also what "field not sent" looks like —
    so without the two being told apart the removal is accepted and quietly
    dropped, which is the worst of the three outcomes.
    """
    service, _, repository, _ = _build()
    repository.get = AsyncMock(return_value=LADDER[1])

    await service.update_tier(tier_id=2, artwork='')

    assert repository.update.await_args.args[1]['artwork'] is None


@pytest.mark.asyncio
async def test_leaving_artwork_out_does_not_touch_it():
    """The other side of the same distinction: renaming must not erase the art."""
    service, _, repository, _ = _build()
    repository.get = AsyncMock(return_value=LADDER[1])

    await service.update_tier(tier_id=2, name='Outro nome')

    assert 'artwork' not in repository.update.await_args.args[1]


@pytest.mark.asyncio
async def test_placement_is_stored_per_tier():
    """Cada arte tem o pé do personagem numa altura diferente do próprio arquivo.

    É por isso que o posicionamento é dado da patente e não uma constante da
    tela: um único offset acerta uma ilustração e erra todas as outras.
    """
    service, _, repository, _ = _build()
    repository.get = AsyncMock(return_value=None)

    await service.create_tier(
        rank=9,
        name='Novo',
        threshold=9_000.0,
        artwork_offset=-35,
        artwork_height=240,
    )

    stored = repository.create.await_args.args[1]
    assert stored['artwork_offset'] == -35
    assert stored['artwork_height'] == 240


@pytest.mark.asyncio
async def test_a_zero_offset_is_a_real_value_not_an_absence():
    """Zero é um offset legítimo: a arte já alinhada não pode ser ignorada."""
    service, _, repository, _ = _build()
    repository.get = AsyncMock(return_value=LADDER[1])

    await service.update_tier(tier_id=2, artwork_offset=0)

    assert repository.update.await_args.args[1]['artwork_offset'] == 0


# ── A flag da arte ───────────────────────────────────────────────

ILLUSTRATED = [
    WealthTier(id=1, rank=1, name='Pedinte', threshold=0.0, artwork=PNG_ARTWORK),
    WealthTier(id=2, rank=2, name='Andarilho', threshold=50_000.0, artwork=PNG_ARTWORK),
]


@pytest.mark.asyncio
async def test_artwork_is_hidden_by_default():
    """Uma carteira que nunca mexeu na configuração não vê o personagem.

    E ele nem sai do banco: a arte pesa centenas de KB, então esconder na tela
    ainda pagaria o download inteiro a cada carregamento.
    """
    service, *_ = _build(_series(60_000.0), tiers=ILLUSTRATED, artwork_enabled=False)

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_tier'].name == 'Andarilho'
    assert standing['current_tier'].artwork is None


@pytest.mark.asyncio
async def test_artwork_appears_once_the_portfolio_asks_for_it():
    service, *_ = _build(_series(60_000.0), tiers=ILLUSTRATED, artwork_enabled=True)

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_tier'].artwork == PNG_ARTWORK


@pytest.mark.asyncio
async def test_hiding_the_artwork_does_not_erase_it_from_the_ladder():
    """A cópia existe por isto: apagar o campo no objeto que veio da sessão é
    uma escrita esperando um commit acontecer por perto."""
    service, *_ = _build(_series(60_000.0), tiers=ILLUSTRATED, artwork_enabled=False)

    await service.get_portfolio_tier(portfolio_id=1)

    assert all(tier.artwork == PNG_ARTWORK for tier in ILLUSTRATED)
