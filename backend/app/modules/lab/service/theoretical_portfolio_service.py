# `list` é método aqui, e o corpo da classe o liga antes de as anotações abaixo
# serem avaliadas: sem este import, `list[TheoreticalPortfolio]` indexaria o
# método em vez do builtin e o módulo não carregaria.
from __future__ import annotations

from app.core.exceptions import AlreadyExistsError, NotFoundError, ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.lab.domain.commands import (
    SaveTheoreticalPortfolioCommand,
    TheoreticalPositionCommand,
)
from app.modules.lab.domain.entities import TheoreticalPortfolio, TheoreticalPosition
from app.modules.lab.domain.presets import PRESETS, Preset


class TheoreticalPortfolioService:
    """As carteiras teóricas que um usuário montou e guardou.

    Guarda parâmetro, e só. O resultado de simular qualquer uma delas é do
    `BacktestService`, e não passa por aqui nem por tabela nenhuma.
    """

    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def list(self, user_id: int) -> list[TheoreticalPortfolio]:
        """As carteiras do usuário, com as linhas juntas.

        As posições vêm sempre: uma carteira teórica sem as linhas é um nome, e
        toda tela que as lista mostra quantos ativos tem e a soma dos pesos.
        """
        async with self.uow as uow:
            return await uow.repository.get(
                TheoreticalPortfolio,
                by={'user_id': user_id},
                order_by='name',
                relations=['positions'],
            )

    async def get(self, theoretical_portfolio_id: int, user_id: int) -> TheoreticalPortfolio:
        async with self.uow as uow:
            return await self._owned(uow, theoretical_portfolio_id, user_id)

    async def create(
        self,
        command: SaveTheoreticalPortfolioCommand,
        user_id: int,
    ) -> TheoreticalPortfolio:
        _validate_positions(command.positions)
        async with self.uow as uow:
            await self._reject_duplicate_name(uow, user_id=user_id, name=command.name)
            portfolio = TheoreticalPortfolio(
                user_id=user_id,
                name=command.name.strip(),
                initial_amount=command.initial_amount,
                contribution_amount=command.contribution_amount,
                contribution_frequency=command.contribution_frequency,
                rebalance_frequency=command.rebalance_frequency,
                benchmark_id=command.benchmark_id,
                positions=[_to_position(item) for item in command.positions],
            )
            await uow.repository.create(TheoreticalPortfolio, [portfolio])
            await uow.commit()
            return portfolio

    async def update(
        self,
        theoretical_portfolio_id: int,
        command: SaveTheoreticalPortfolioCommand,
        user_id: int,
    ) -> TheoreticalPortfolio:
        """Substitui a carteira inteira, linhas incluídas.

        A lista de posições chega completa e substitui a anterior, em vez de um
        diff linha a linha: quem edita pesos mexe em vários de uma vez para a
        soma continuar fechando, e mandar o estado final é o que evita a tela
        ter de descobrir quais linhas mudaram.
        """
        _validate_positions(command.positions)
        async with self.uow as uow:
            portfolio = await self._owned(uow, theoretical_portfolio_id, user_id)
            await self._reject_duplicate_name(
                uow,
                user_id=user_id,
                name=command.name,
                ignore_id=theoretical_portfolio_id,
            )

            portfolio.name = command.name.strip()
            portfolio.initial_amount = command.initial_amount
            portfolio.contribution_amount = command.contribution_amount
            portfolio.contribution_frequency = command.contribution_frequency
            portfolio.rebalance_frequency = command.rebalance_frequency
            portfolio.benchmark_id = command.benchmark_id
            portfolio.positions = [_to_position(item) for item in command.positions]

            await uow.commit()
            return portfolio

    async def delete(self, theoretical_portfolio_id: int, user_id: int) -> None:
        async with self.uow as uow:
            await self._owned(uow, theoretical_portfolio_id, user_id)
            await uow.repository.delete(TheoreticalPortfolio, id=theoretical_portfolio_id)
            await uow.commit()

    @staticmethod
    def list_presets() -> list[Preset]:
        """Os modelos fixos. Não passam pelo banco: são código."""
        return list(PRESETS)

    @staticmethod
    async def _owned(
        uow: UnitOfWork,
        theoretical_portfolio_id: int,
        user_id: int,
    ) -> TheoreticalPortfolio:
        """A carteira, se ela for de quem está pedindo.

        Um id de outro usuário responde "não encontrada" e não "proibida": quem
        não é dono não deveria nem descobrir que o id existe.
        """
        portfolio = await uow.repository.get(
            TheoreticalPortfolio,
            id=theoretical_portfolio_id,
            relations=['positions'],
        )
        if portfolio is None or portfolio.user_id != user_id:
            raise NotFoundError('Carteira teórica não encontrada.')
        return portfolio

    @staticmethod
    async def _reject_duplicate_name(
        uow: UnitOfWork,
        *,
        user_id: int,
        name: str,
        ignore_id: int | None = None,
    ) -> None:
        existing = await uow.repository.get(
            TheoreticalPortfolio,
            by={'user_id': user_id, 'name': name.strip()},
            first=True,
        )
        if existing is not None and existing.id != ignore_id:
            raise AlreadyExistsError(f'Você já tem uma carteira teórica chamada "{name}".')


def _to_position(command: TheoreticalPositionCommand) -> TheoreticalPosition:
    return TheoreticalPosition(
        weight=command.weight,
        asset_id=command.asset_id,
        series_id=command.series_id,
        fixed_income_type_id=command.fixed_income_type_id,
        rate=command.rate,
        label=command.label,
    )


def _validate_positions(positions: list[TheoreticalPositionCommand]) -> None:
    """O que o banco não consegue recusar sozinho.

    O CHECK da tabela garante que uma linha é ou ativo ou sintética. O que
    falta é o que só se vê olhando a lista: ela não pode estar vazia, o mesmo
    ativo não entra duas vezes, e peso negativo não existe — venda a
    descoberto não é coisa que o laboratório simule.
    """
    if not positions:
        raise ValidationError('A carteira teórica precisa de pelo menos uma linha.')

    if any(position.weight < 0 for position in positions):
        raise ValidationError('Peso negativo não é uma posição.')

    if sum(position.weight for position in positions) <= 0:
        raise ValidationError('A carteira teórica precisa de algum peso positivo.')

    asset_ids = [item.asset_id for item in positions if item.asset_id is not None]
    if len(asset_ids) != len(set(asset_ids)):
        raise ValidationError('O mesmo ativo aparece mais de uma vez na carteira.')

    for position in positions:
        if position.asset_id is None and (
            position.fixed_income_type_id is None or position.rate is None
        ):
            raise ValidationError(
                'Uma linha sem ativo precisa de um tipo de rentabilidade e de uma taxa.'
            )
