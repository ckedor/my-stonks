"""Wealth-tier service: a portfolio's standing on a ladder fixed in code."""

from __future__ import annotations

import math
from collections.abc import Sequence
from datetime import date, datetime

from app.modules.portfolio.domain.wealth_tier_ladder import LADDER, WealthTier
from app.modules.portfolio.service.portfolio_position_service import (
    PortfolioPositionService,
)

# Teto da busca pelo mês de chegada. Cinquenta anos adiante já não é uma
# previsão, é um número bonito — acima disso a tela não promete data nenhuma.
MAX_PROJECTION_MONTHS = 600


class PortfolioWealthTierService:
    """A escala é fixa, em código: ver `domain.wealth_tier_ladder`.

    Nada aqui edita degraus, porque não há o que editar — o título e o preço de
    cada um andam no mesmo commit que o cenário desenhado para ele. O serviço
    responde a uma pergunta só: onde esta carteira está na escala, e quando ela
    chega ao degrau seguinte.
    """

    def __init__(
        self,
        position_service: PortfolioPositionService,
        ladder: Sequence[WealthTier] = LADDER,
    ):
        self.position_service = position_service
        #: A escala em vigor. O parâmetro existe para o teste poder montar uma
        #: escala curta e legível; em produção é sempre `LADDER`.
        self.ladder = ladder

    async def list_tiers(self) -> list[WealthTier]:
        """A escala inteira, do degrau mais baixo ao mais alto."""
        return list(self.ladder)

    # ── A portfolio's standing ───────────────────────────────────

    async def get_portfolio_tier(self, portfolio_id: int) -> dict:
        """The tier a portfolio has earned, and how far the next one is.

        O degrau é o de hoje, e não o do melhor dia: a escala mede onde a
        carteira está, então ela também desce. Uma patente presa no pico
        deixava a tela dizendo "Escudeiro" com uma barra que media a distância
        para o degrau seguinte a partir de um valor que a carteira já não tem —
        o título falava de um mês e a barra de outro.

        O pico continua a ser devolvido em `peak_patrimony`, porque é o que
        conta a história do álbum; ele não decide mais o título.
        """
        tiers = await self.list_tiers()
        peak, current_value = await self._patrimony_peak_and_current(portfolio_id)

        current = None
        following = None
        for tier in tiers:
            if tier.threshold <= current_value:
                current = tier
            elif following is None:
                following = tier

        remaining = None if following is None else max(following.threshold - current_value, 0.0)
        projection = await self._projection(portfolio_id, current_value, following)
        return {
            'peak_patrimony': peak,
            'current_patrimony': current_value,
            'current_tier': current,
            'next_tier': following,
            'remaining': remaining,
            'progress': self._progress(current, following, current_value),
            'projection': projection,
        }

    async def _projection(
        self,
        portfolio_id: int,
        current_value: float,
        following: WealthTier | None,
    ) -> dict | None:
        """Quando o degrau seguinte chega, se nada mudar de ritmo.

        Duas coisas movem o patrimônio, e a projeção usa exatamente essas duas:
        o dinheiro que entra — a média de aporte dos últimos meses — e o que o
        que já está dentro rende, na taxa anual que a carteira vem entregando.
        Nenhuma das duas é uma promessa; juntas são a única resposta honesta
        para "quanto tempo falta", que é a pergunta que a barra provoca.

        Sem degrau seguinte, sem histórico, ou com ritmo que não chega lá em
        cinquenta anos, a projeção é `None`: melhor não dizer data nenhuma do
        que dizer uma que o próprio cálculo não sustenta.
        """
        if following is None or current_value <= 0:
            return None

        monthly_contribution = await self._monthly_contribution(portfolio_id)
        annual_rate = await self._annual_rate(portfolio_id)
        monthly_rate = (1 + annual_rate) ** (1 / 12) - 1

        value = current_value
        months = 0
        while value < following.threshold and months < MAX_PROJECTION_MONTHS:
            value = value * (1 + monthly_rate) + monthly_contribution
            months += 1

        if value < following.threshold:
            return None

        today = date.today()
        total = today.month - 1 + months
        target = date(today.year + total // 12, total % 12 + 1, 1)
        return {
            'monthly_contribution': monthly_contribution,
            'annual_rate': annual_rate,
            'months': months,
            'target_date': target.isoformat(),
        }

    async def _monthly_contribution(self, portfolio_id: int) -> float:
        """Quanto entrou por mês, em média, na história inteira da carteira.

        O aporte acumulado é o que a série guarda, então a média sai da
        diferença entre as duas pontas dividida pelos meses entre elas — e não
        da média das linhas, que contaria os dias sem aporte como zero.

        A janela é toda a história, e não os últimos meses, pela mesma razão
        que a taxa é o CAGR da série inteira: a projeção fala de anos, e um
        ritmo medido em doze meses faz a data pular a cada semestre bom ou
        ruim. O par que a tela mostra é o ritmo de sempre, não o de agora.
        """
        evolution = await self.position_service.get_patrimony_evolution(
            portfolio_id, currency='BRL'
        )
        if not evolution:
            return 0.0

        points = [
            (self._as_date(entry.get('date')), self._as_number(entry.get('acc_aported')))
            for entry in evolution
        ]
        points = [(day, value) for day, value in points if day is not None and value is not None]
        if len(points) < 2:
            return 0.0

        points.sort(key=lambda point: point[0])
        last_day, last_value = points[-1]
        first_day, first_value = points[0]
        months = (last_day.year - first_day.year) * 12 + last_day.month - first_day.month
        if months <= 0:
            return 0.0
        return max((last_value - first_value) / months, 0.0)

    async def _annual_rate(self, portfolio_id: int) -> float:
        """A taxa anual que a carteira vem entregando, como fração.

        Vem do CAGR já consolidado da série de retorno, que é a mesma taxa que
        a tela de rentabilidade mostra — duas telas discordando sobre o
        rendimento da carteira seria pior do que nenhuma projeção.
        """
        series = await self.position_service.get_portfolio_returns(portfolio_id)
        if not series:
            return 0.0
        for entry in reversed(list(series)):
            cagr = self._as_number(entry.get('cagr'))
            if cagr is not None:
                # O consolidador escreve o CAGR como fração — 0.2586 para
                # 25,86% — que é como a tela de rentabilidade o lê antes de
                # multiplicar por cem. Dividir aqui de novo derrubava a taxa
                # para um centésimo dela e empurrava a data anos à frente.
                return max(cagr, 0.0)
        return 0.0

    @staticmethod
    def _as_number(value) -> float | None:
        if not isinstance(value, int | float) or isinstance(value, bool):
            return None
        return float(value) if math.isfinite(float(value)) else None

    @staticmethod
    def _as_date(value) -> date | None:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value[:10]).date()
            except ValueError:
                return None
        return None

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
        """Quanto da travessia entre o degrau atual e o próximo já foi feito.

        O trecho é o que a barra promete: o "Faltam" ao lado dela mede daqui
        até o degrau seguinte, e a barra tem de medir a mesma distância. Sobre
        o valor cheio do alvo, uma carteira que acabou de subir de degrau já
        aparecia quase no fim.
        """
        if following is None:
            return 1.0
        floor = current.threshold if current else 0.0
        span = following.threshold - floor
        if span <= 0:
            return 1.0
        return min(max((current_value - floor) / span, 0.0), 1.0)
