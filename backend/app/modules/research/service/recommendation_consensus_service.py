"""Consenso das carteiras recomendadas, calculado na leitura."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.domain.assets import Asset, AssetType
from app.modules.research.domain.consensus import (
    RecommendationConsensus,
    RecommendationConsensusEntry,
)
from app.modules.research.domain.entities import RecommendedPortfolio, RecommendedPosition
from app.modules.research.domain.enums import RecommendationChange

#: Quantos meses para trás uma edição ainda fala do presente. Uma recomendação
#: de dois anos atrás não é uma recomendação, e a janela é o que faz uma
#: carteira que parou de ser publicada parar de votar sozinha — sem ninguém
#: precisar apagar nada.
DEFAULT_WINDOW_MONTHS = 3


@dataclass
class _Tally:
    """O acumulado de um ativo enquanto as carteiras são percorridas."""

    asset_id: int
    source_ids: set[int] = field(default_factory=set)
    source_names: list[str] = field(default_factory=list)
    portfolios: int = 0
    weights: list[float] = field(default_factory=list)
    convictions: list[float] = field(default_factory=list)
    entered: int = 0
    increased: int = 0
    reduced: int = 0


class RecommendationConsensusService:
    """Quantas casas recomendam cada ativo, entre as carteiras vigentes.

    Nada disso é gravado: o consenso é a contagem das recomendações que já
    estão no banco, e persisti-lo criaria um segundo lugar para ficar velho.
    """

    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def get(
        self,
        *,
        asset_type_short_name: str | None = None,
        window_months: int = DEFAULT_WINDOW_MONTHS,
    ) -> RecommendationConsensus:
        """O ranking dos ativos mais recomendados, do tipo pedido.

        O recorte por tipo é feito pelo lado da **posição**, e não pelo tipo da
        carteira: uma carteira "Mundo" com três FIIs dentro contribui com esses
        três, e filtrar pela prateleira a deixaria inteira de fora.
        """
        floor = self._window_floor(window_months)

        async with self.uow as uow:
            portfolios = await uow.repository.get(RecommendedPortfolio, relations=['positions'])
            current = self._current_editions(portfolios, floor)
            if not current:
                return RecommendationConsensus(window_months=window_months)

            asset_type_id = None
            if asset_type_short_name:
                asset_type = await uow.repository.get(
                    AssetType, by={'short_name': asset_type_short_name}, first=True
                )
                if asset_type is None:
                    return RecommendationConsensus(window_months=window_months)
                asset_type_id = asset_type.id

            asset_ids = {
                position.asset_id
                for portfolio in current
                for position in portfolio.positions
                if position.asset_id is not None
            }
            assets = await uow.assets.get_by_ids(sorted(asset_ids))

        by_id: dict[int, Asset] = {
            asset.id: asset
            for asset in assets
            if asset_type_id is None or asset.asset_type_id == asset_type_id
        }

        tallies, unlinked = self._tally(current, by_id)
        entries = [self._entry(tally, by_id[tally.asset_id]) for tally in tallies.values()]
        # Consenso primeiro, convicção como desempate: a aba fala de quanta
        # gente aponta o mesmo ativo, e o tamanho da posição é o segundo
        # assunto, não o primeiro.
        entries.sort(key=lambda entry: (entry.houses, entry.conviction), reverse=True)

        dates = [portfolio.reference_date for portfolio in current]
        return RecommendationConsensus(
            entries=entries,
            considered_portfolios=len(current),
            considered_sources=len({portfolio.source_id for portfolio in current}),
            unlinked_positions=unlinked,
            window_months=window_months,
            oldest_reference_date=min(dates) if dates else None,
            newest_reference_date=max(dates) if dates else None,
        )

    @staticmethod
    def _window_floor(window_months: int) -> date | None:
        """O primeiro dia do mês a partir do qual uma edição ainda conta."""
        if window_months <= 0:
            return None
        today = date.today()
        total = today.year * 12 + (today.month - 1) - (window_months - 1)
        return date(total // 12, total % 12 + 1, 1)

    @staticmethod
    def _current_editions(
        portfolios: list[RecommendedPortfolio], floor: date | None
    ) -> list[RecommendedPortfolio]:
        """A edição vigente de cada carteira, dentro da janela.

        A unidade de opinião é a carteira — a casa mais o título —, e a opinião
        dela é a edição mais recente. Sem esse corte uma casa que republica a
        mesma carteira há um ano votaria doze vezes.
        """
        latest: dict[tuple[int, str], RecommendedPortfolio] = {}
        for portfolio in portfolios:
            if floor is not None and portfolio.reference_date < floor:
                continue
            key = (portfolio.source_id, portfolio.title)
            kept = latest.get(key)
            if kept is None or portfolio.reference_date > kept.reference_date:
                latest[key] = portfolio
        return list(latest.values())

    @staticmethod
    def _tally(
        portfolios: list[RecommendedPortfolio], by_id: dict[int, Asset]
    ) -> tuple[dict[int, _Tally], int]:
        tallies: dict[int, _Tally] = {}
        unlinked = 0

        for portfolio in portfolios:
            # `exited` é a casa dizendo que saiu do ativo. Contar como
            # recomendação inverteria o sinal do relatório.
            lines: list[RecommendedPosition] = [
                position
                for position in portfolio.positions
                if position.change != RecommendationChange.EXITED
            ]
            counted = [line for line in lines if line.asset_id in by_id]
            unlinked += sum(1 for line in lines if line.asset_id is None)
            if not counted:
                continue

            # A convicção é medida contra a carteira inteira, e não contra as
            # linhas que sobreviveram ao filtro de tipo: o peso médio de uma
            # carteira é dela, não do recorte que a tela pediu.
            total = sum(line.weight for line in lines if line.weight > 0)
            mean = total / len(lines) if lines and total > 0 else 0.0

            for line in counted:
                tally = tallies.setdefault(line.asset_id, _Tally(asset_id=line.asset_id))
                tally.portfolios += 1
                if portfolio.source_id not in tally.source_ids:
                    tally.source_ids.add(portfolio.source_id)
                    if portfolio.source is not None:
                        tally.source_names.append(portfolio.source.name)
                tally.weights.append(line.weight)
                tally.convictions.append(line.weight / mean if mean > 0 else 0.0)
                if line.change == RecommendationChange.ENTERED:
                    tally.entered += 1
                elif line.change == RecommendationChange.INCREASED:
                    tally.increased += 1
                elif line.change == RecommendationChange.REDUCED:
                    tally.reduced += 1

        return tallies, unlinked

    @staticmethod
    def _entry(tally: _Tally, asset: Asset) -> RecommendationConsensusEntry:
        return RecommendationConsensusEntry(
            asset_id=asset.id,
            ticker=asset.ticker or '',
            name=asset.name,
            logo_url=asset.logo_url,
            houses=len(tally.source_ids),
            portfolios=tally.portfolios,
            average_weight=sum(tally.weights) / len(tally.weights) if tally.weights else 0.0,
            conviction=(
                sum(tally.convictions) / len(tally.convictions) if tally.convictions else 0.0
            ),
            entered=tally.entered,
            increased=tally.increased,
            reduced=tally.reduced,
            source_names=sorted(tally.source_names),
        )
