"""Wealth-tier service: the ladder's CRUD and a portfolio's standing on it."""

from __future__ import annotations

import base64
import binascii
import math
import re
from dataclasses import replace

from app.core.exceptions import AlreadyExistsError, NotFoundError, ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.domain.entities import (
    ConfigurationName,
    PortfolioUserConfiguration,
    WealthTier,
)
from app.modules.portfolio.service.portfolio_position_service import (
    PortfolioPositionService,
)

# Large enough for a detailed character illustration, small enough that the
# ladder stays cheap to fetch: every tier's artwork rides along with the list.
# Base64 costs about a third on top of the file, and the limit is on what is
# stored, so this is roughly a 380KB image.
MAX_ARTWORK_BYTES = 512 * 1024

# Raster and vector both, because the choice belongs to the drawing: pixel art
# is raster by nature and gains nothing from being traced into paths.
ALLOWED_ARTWORK_TYPES = ('image/png', 'image/svg+xml', 'image/webp', 'image/gif')

# A arte é opcional por carteira e nasce escondida: o personagem é um enfeite
# forte, e quem não pediu por ele não deve ganhá-lo por padrão. A ausência de
# configuração já significa desligado, então nenhuma linha precisa ser criada.
ARTWORK_SETTING = 'wealth_tier_artwork'

_DATA_URI = re.compile(r'^data:(?P<mime>[\w.+/-]+);base64,(?P<payload>[A-Za-z0-9+/=\s]+)$')
_EVENT_HANDLER = re.compile(r'\bon[a-z]+\s*=', re.IGNORECASE)
_SCRIPT_TAG = re.compile(r'<\s*script', re.IGNORECASE)


class PortfolioWealthTierService:
    """The ladder is data. Nothing here may assume a rung count or a title."""

    def __init__(self, uow: UnitOfWork, position_service: PortfolioPositionService):
        self.uow = uow
        self.position_service = position_service

    # ── Ladder CRUD ──────────────────────────────────────────────

    async def list_tiers(self) -> list[WealthTier]:
        async with self.uow as uow:
            tiers = await uow.repository.get(WealthTier)
        return sorted(tiers, key=lambda tier: tier.rank)

    async def create_tier(  # noqa: PLR0913
        self,
        rank: int,
        name: str,
        threshold: float,
        artwork: str | None = None,
        artwork_offset: int = 0,
        artwork_height: int | None = None,
    ) -> WealthTier:
        artwork = self._validate_artwork(artwork)
        self._validate_threshold(threshold)
        async with self.uow as uow:
            await self._assert_available(uow, rank=rank, name=name, threshold=threshold)
            data = {
                'rank': rank,
                'name': name,
                'threshold': threshold,
                'artwork': artwork,
                'artwork_offset': artwork_offset,
                'artwork_height': artwork_height,
            }
            await uow.repository.create(WealthTier, data)
            created = await uow.repository.get(WealthTier, by={'rank': rank}, first=True)
            await uow.commit()
            return created

    async def update_tier(  # noqa: PLR0913
        self,
        tier_id: int,
        rank: int | None = None,
        name: str | None = None,
        threshold: float | None = None,
        artwork: str | None = None,
        artwork_offset: int | None = None,
        artwork_height: int | None = None,
    ) -> WealthTier:
        # An absent `artwork` leaves the illustration alone; an empty one asks for
        # it to be removed. Without the distinction the two collapse — the
        # validator normalises empty to None, and the update below would read
        # that as "not sent" and silently ignore the removal.
        clear_artwork = artwork is not None and not artwork.strip()
        artwork = self._validate_artwork(artwork)
        if threshold is not None:
            self._validate_threshold(threshold)

        async with self.uow as uow:
            tier = await uow.repository.get(WealthTier, id=tier_id)
            if not tier:
                raise NotFoundError('Wealth tier not found')

            await self._assert_available(
                uow,
                rank=rank if rank != tier.rank else None,
                name=name if name != tier.name else None,
                threshold=threshold if threshold != tier.threshold else None,
                ignore_id=tier_id,
            )

            update_data: dict = {'id': tier_id}
            if rank is not None:
                update_data['rank'] = rank
            if name is not None:
                update_data['name'] = name
            if threshold is not None:
                update_data['threshold'] = threshold
            if artwork is not None or clear_artwork:
                update_data['artwork'] = artwork
            if artwork_offset is not None:
                update_data['artwork_offset'] = artwork_offset
            if artwork_height is not None:
                update_data['artwork_height'] = artwork_height

            await uow.repository.update(WealthTier, update_data)
            updated = await uow.repository.get(WealthTier, id=tier_id)
            await uow.commit()
            return updated

    async def delete_tier(self, tier_id: int) -> None:
        async with self.uow as uow:
            tier = await uow.repository.get(WealthTier, id=tier_id)
            if not tier:
                raise NotFoundError('Wealth tier not found')
            await uow.repository.delete(WealthTier, id=tier_id)
            await uow.commit()

    # ── A portfolio's standing ───────────────────────────────────

    async def get_portfolio_tier(self, portfolio_id: int) -> dict:
        """The tier a portfolio has earned, and how far the next one is.

        Two different numbers answer two different questions, and mixing them up
        is what this method exists to keep straight:

        - the **peak** earns the tier. A rung is reached once and never lost, so
          the title is decided by the highest the patrimony has ever been.
          Reading the peak off the existing series is what makes that promise
          hold for free — no high-water mark stored anywhere to drift out of
          step with the history, and repricing a rung in the CRUD re-answers it
          consistently for every portfolio instead of freezing old winners;
        - the **current** value measures the climb. What is left to reach the
          next rung is a question about today, not about a past high, so a
          portfolio that fell back sees the distance it actually has to cover.
        """
        tiers = await self.list_tiers()
        peak, current_value = await self._patrimony_peak_and_current(portfolio_id)
        show_artwork = await self._artwork_enabled(portfolio_id)

        current = None
        following = None
        for tier in tiers:
            if tier.threshold <= peak:
                current = tier
            elif following is None:
                following = tier

        if not show_artwork and current is not None and current.artwork:
            # Uma cópia, e não o objeto mapeado: apagar o campo na instância que
            # veio da sessão é uma escrita esperando um commit acontecer perto.
            # E é aqui, e não na tela, porque a arte pesa centenas de KB —
            # desligada, ela não precisa nem sair do banco para o navegador.
            current = replace(current, artwork=None)

        remaining = None if following is None else max(following.threshold - current_value, 0.0)
        return {
            'peak_patrimony': peak,
            'current_patrimony': current_value,
            'current_tier': current,
            'next_tier': following,
            'remaining': remaining,
            'progress': self._progress(current, following, current_value),
        }

    async def _artwork_enabled(self, portfolio_id: int) -> bool:
        """Whether this portfolio asked to see the tier illustration.

        Never configured reads as off, which is the default the setting is meant
        to have — so a portfolio created tomorrow behaves like every other one
        without anybody remembering to seed a row for it.
        """
        async with self.uow as uow:
            setting = await uow.repository.get(
                ConfigurationName, by={'name': ARTWORK_SETTING}, first=True
            )
            if not setting:
                return False
            configured = await uow.repository.get(
                PortfolioUserConfiguration,
                by={'portfolio_id': portfolio_id, 'configuration_name_id': setting.id},
                first=True,
            )
        return bool(configured and configured.enabled)

    async def _patrimony_peak_and_current(self, portfolio_id: int) -> tuple[float, float]:
        """The portfolio's highest and latest daily totals, both in BRL.

        Both come off the same series in one pass, so the title and the distance
        to the next one can never be read from two different histories.

        BRL and not the caller's display currency on purpose: a title that moved
        a rung when the currency selector changed would not be a title.
        """
        evolution = await self.position_service.get_patrimony_evolution(
            portfolio_id, currency='BRL'
        )
        if not evolution:
            return 0.0, 0.0

        peak = 0.0
        latest = 0.0
        for entry in evolution:
            value = entry.get('portfolio')
            if not isinstance(value, int | float) or not math.isfinite(value):
                continue
            value = float(value)
            latest = value
            peak = max(peak, value)
        return peak, latest

    @staticmethod
    def _progress(
        current: WealthTier | None,
        following: WealthTier | None,
        current_value: float,
    ) -> float:
        """How far along the current rung today's value sits, as a 0-1 fraction.

        Clamped at the bottom because the two numbers answer different
        questions: a portfolio that earned a rung and then fell below its floor
        keeps the title, and an empty bar is what that looks like.
        """
        if following is None:
            return 1.0
        floor = current.threshold if current else 0.0
        span = following.threshold - floor
        if span <= 0:
            return 1.0
        return min(max((current_value - floor) / span, 0.0), 1.0)

    # ── Validation ───────────────────────────────────────────────

    @staticmethod
    def _validate_threshold(threshold: float) -> None:
        if threshold < 0:
            raise ValidationError('Wealth tier threshold cannot be negative')

    @staticmethod
    def _validate_artwork(artwork: str | None) -> str | None:
        """Accept one base64 image data URI and nothing else.

        The artwork is stored as the picture itself, not as a path or a storage
        key, which is what keeps the ladder a plain CRUD table: no bucket, no
        volume, no static route to keep in step with the rows. A data URI is
        text, so it travels and persists like any other column.

        The URI is also the exact string the card puts in an `<img>`, so what is
        validated here is what is rendered there — no reassembly in between that
        could turn a rejected file into a rendered one.
        """
        if artwork is None:
            return None

        artwork = artwork.strip()
        if not artwork:
            return None

        if len(artwork.encode('utf-8')) > MAX_ARTWORK_BYTES:
            raise ValidationError(f'Artwork exceeds the {MAX_ARTWORK_BYTES // 1024}KB limit')

        match = _DATA_URI.match(artwork)
        if not match:
            raise ValidationError('Artwork must be a base64 image data URI')

        mime = match.group('mime').lower()
        if mime not in ALLOWED_ARTWORK_TYPES:
            allowed = ', '.join(ALLOWED_ARTWORK_TYPES)
            raise ValidationError(f'Artwork must be one of: {allowed}')

        try:
            payload = base64.b64decode(match.group('payload'), validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValidationError('Artwork is not valid base64') from error

        if not payload:
            raise ValidationError('Artwork is empty')

        # SVG is the one allowed type that can carry behaviour. The card renders
        # every artwork through `<img>`, where none of it runs, but the column
        # outlives the component that reads it today.
        if mime == 'image/svg+xml':
            markup = payload.decode('utf-8', errors='replace')
            if _SCRIPT_TAG.search(markup) or _EVENT_HANDLER.search(markup):
                raise ValidationError('Artwork may not contain scripts or event handlers')

        return artwork

    async def _assert_available(
        self,
        uow,
        rank: int | None = None,
        name: str | None = None,
        threshold: float | None = None,
        ignore_id: int | None = None,
    ) -> None:
        """Rank, name, and threshold each identify a rung, so each stays unique.

        Two rungs sharing a threshold would make the ladder ambiguous exactly
        where it is read: the tier a peak earns would depend on row order.
        """
        for field, value, message in (
            ('rank', rank, 'A wealth tier with this rank already exists'),
            ('name', name, 'A wealth tier with this name already exists'),
            ('threshold', threshold, 'A wealth tier with this threshold already exists'),
        ):
            if value is None:
                continue
            existing = await uow.repository.get(WealthTier, by={field: value}, first=True)
            if existing and existing.id != ignore_id:
                raise AlreadyExistsError(message)
