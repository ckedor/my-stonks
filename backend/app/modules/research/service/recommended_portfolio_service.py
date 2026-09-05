# `list` is a method here, and a class body binds it before the annotations
# below it are evaluated: without this import `list[ResearchSource]` would
# subscript the method instead of the builtin, and the module would not load.
from __future__ import annotations

from app.core.exceptions import AlreadyExistsError, NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.research.domain.commands import SaveRecommendedPortfolioCommand
from app.modules.research.domain.entities import (
    RecommendedPortfolio,
    RecommendedPortfolioType,
    RecommendedPosition,
    ResearchSource,
)
from app.modules.research.domain.slug import slugify


class RecommendedPortfolioService:
    """The recommended portfolios that were read, confirmed and kept."""

    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def list(self) -> list[RecommendedPortfolio]:
        """Every edition, most recent first.

        Positions come along: a recommended portfolio without its lines is a
        title and a date, and every screen that lists them counts the assets.
        """
        async with self.uow as uow:
            return await uow.repository.get(
                RecommendedPortfolio,
                order_by='reference_date desc',
                relations=['positions'],
            )

    async def get(self, recommended_portfolio_id: int) -> RecommendedPortfolio:
        async with self.uow as uow:
            portfolio = await uow.repository.get(
                RecommendedPortfolio,
                id=recommended_portfolio_id,
                relations=['positions'],
            )
            if portfolio is None:
                raise NotFoundError('Carteira recomendada não encontrada.')
            return portfolio

    async def list_sources(self) -> list[ResearchSource]:
        async with self.uow as uow:
            return await uow.repository.get(ResearchSource, order_by='name')

    async def list_types(self) -> list[RecommendedPortfolioType]:
        async with self.uow as uow:
            return await uow.repository.get(RecommendedPortfolioType, order_by='name')

    async def create_type(self, name: str) -> RecommendedPortfolioType:
        """Um tipo novo, cadastrado da própria tela que classifica a carteira.

        O slug é o que impede "ETF Global" e "etf global" de virarem dois tipos
        com metade das carteiras cada.
        """
        async with self.uow as uow:
            slug = slugify(name)
            existing = await uow.repository.get(
                RecommendedPortfolioType, by={'slug': slug}, first=True
            )
            if existing is not None:
                raise AlreadyExistsError(f'O tipo "{existing.name}" já está cadastrado.')
            portfolio_type = RecommendedPortfolioType(name=name.strip(), slug=slug)
            await uow.repository.create(RecommendedPortfolioType, [portfolio_type])
            await uow.commit()
            return portfolio_type

    async def delete_type(self, type_id: int) -> None:
        """Apagar o tipo não apaga as carteiras: elas voltam a ficar sem tipo."""
        async with self.uow as uow:
            portfolio_type = await uow.repository.get(RecommendedPortfolioType, id=type_id)
            if portfolio_type is None:
                raise NotFoundError('Tipo de carteira não encontrado.')
            await uow.repository.delete(RecommendedPortfolioType, id=type_id)
            await uow.commit()

    async def set_type(
        self, recommended_portfolio_id: int, type_id: int | None
    ) -> RecommendedPortfolio:
        """Reclassificar uma edição já salva.

        O tipo é a única coisa que a tela edita depois da importação: o resto
        veio do relatório e mudar seria discordar dele, não corrigi-lo.

        Um escopo só, do começo ao fim: `self.get` abriria a mesma UnitOfWork
        por dentro desta, e ela não se entra duas vezes. O tipo carregado é
        atribuído junto com o `type_id` porque é ele que a resposta serializa —
        deixar a relação para o ORM resolver depois do commit seria IO fora do
        escopo.
        """
        async with self.uow as uow:
            portfolio = await uow.repository.get(
                RecommendedPortfolio, id=recommended_portfolio_id, relations=['positions']
            )
            if portfolio is None:
                raise NotFoundError('Carteira recomendada não encontrada.')

            portfolio_type = None
            if type_id is not None:
                portfolio_type = await uow.repository.get(RecommendedPortfolioType, id=type_id)
                if portfolio_type is None:
                    raise NotFoundError('Tipo de carteira não encontrado.')

            portfolio.type_id = type_id
            portfolio.type = portfolio_type
            await uow.commit()
            return portfolio

    async def create(self, command: SaveRecommendedPortfolioCommand) -> RecommendedPortfolio:
        async with self.uow as uow:
            source = await self._resolve_source(uow, command.source_name)
            await self._reject_duplicate(uow, source_id=source.id, command=command)

            portfolio = RecommendedPortfolio(
                source_id=source.id,
                source=source,
                type_id=command.type_id,
                title=command.title,
                reference_date=command.reference_date,
                summary=command.summary,
                objective=command.objective,
                positions=[
                    RecommendedPosition(
                        asset_id=position.asset_id,
                        ticker=position.ticker,
                        name=position.name,
                        weight=position.weight,
                        rationale=position.rationale,
                        target_price=position.target_price,
                        change=position.change,
                    )
                    for position in command.positions
                ],
            )
            await uow.repository.create(RecommendedPortfolio, [portfolio])
            await uow.commit()
            return portfolio

    async def delete(self, recommended_portfolio_id: int) -> None:
        async with self.uow as uow:
            portfolio = await uow.repository.get(RecommendedPortfolio, id=recommended_portfolio_id)
            if portfolio is None:
                raise NotFoundError('Carteira recomendada não encontrada.')
            await uow.repository.delete(RecommendedPortfolio, id=recommended_portfolio_id)
            await uow.commit()

    @staticmethod
    async def _resolve_source(uow: UnitOfWork, name: str) -> ResearchSource:
        """The house the reader typed, created on its first report."""
        slug = slugify(name)
        source = await uow.repository.get(ResearchSource, by={'slug': slug}, first=True)
        if source is not None:
            return source
        source = ResearchSource(name=name.strip(), slug=slug)
        await uow.repository.create(ResearchSource, [source])
        return source

    @staticmethod
    async def _reject_duplicate(
        uow: UnitOfWork,
        *,
        source_id: int,
        command: SaveRecommendedPortfolioCommand,
    ) -> None:
        """The same house, the same carteira, the same month is one edition.

        Uploading the same PDF twice is the easy mistake to make on this
        screen, and two copies of an edition would double-count it in anything
        that later measures how the recommendation fared.
        """
        existing = await uow.repository.get(
            RecommendedPortfolio,
            by={
                'source_id': source_id,
                'title': command.title,
                'reference_date': command.reference_date,
            },
            first=True,
        )
        if existing is not None:
            raise AlreadyExistsError(
                f'A carteira "{command.title}" de {command.reference_date:%m/%Y} '
                f'já foi cadastrada para esta fonte.'
            )
