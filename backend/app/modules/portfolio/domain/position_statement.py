"""Conferência de posição: o que a corretora diz que custodia contra o que o app soma.

Nada aqui é gravado. A resposta é um diagnóstico — onde as quantidades
divergem, e que ativo aparece de um lado e não do outro — para a pessoa ir às
transações daquele ativo e corrigir o histórico.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from app.modules.portfolio.domain.brokerage_note import AssetMatch, Currency, NoteWarning

#: Extratos arredondam frações de ação a quatro ou cinco casas; abaixo disso a
#: diferença é arredondamento, não operação faltando.
QUANTITY_TOLERANCE = 1e-4


class PositionMatch(StrEnum):
    MATCH = 'match'
    #: O ativo está dos dois lados, com quantidades diferentes.
    DIFFERENT = 'different'
    #: O extrato custodia e o app não tem posição nesta corretora.
    MISSING_IN_APP = 'missing_in_app'
    #: O app tem posição nesta corretora e o extrato não mostra o ativo.
    MISSING_IN_STATEMENT = 'missing_in_statement'
    #: Linha do extrato sem ativo escolhido: não há com o que comparar.
    UNRESOLVED = 'unresolved'


@dataclass(frozen=True, kw_only=True)
class StatementHolding:
    """Uma linha do extrato como a pessoa a conferiu: o ativo escolhido, ou não."""

    index: int
    security: str
    ticker: str | None
    quantity: float
    asset_id: int | None


@dataclass(frozen=True, kw_only=True)
class PositionDiff:
    key: str
    status: PositionMatch
    asset_id: int | None
    #: O que o extrato custodia, somadas as linhas do mesmo ativo.
    statement_quantity: float | None
    #: O que as transações do app somam nesta corretora até a data.
    app_quantity: float | None
    #: Extrato menos app: positivo é o que falta lançar no app.
    difference: float | None
    holdings: tuple[int, ...]


def held_quantities(transactions: Iterable, events: Iterable, as_of: date) -> dict[int, float]:
    """Quantidade de cada ativo na data, com desdobramentos e grupamentos aplicados.

    Um evento multiplica pelo seu fator o que foi comprado antes dele, como no
    informe de IR e no recálculo de posição — só os eventos até a data contam,
    porque o extrato é daquele dia.
    """
    factors: dict[int, list[tuple[date, float]]] = defaultdict(list)
    for event in events:
        if event.date <= as_of:
            factors[event.asset_id].append((event.date, float(event.factor)))

    quantities: dict[int, float] = defaultdict(float)
    for transaction in transactions:
        day = transaction.date.date() if hasattr(transaction.date, 'date') else transaction.date
        if day > as_of:
            continue
        quantity = transaction.quantity
        for event_day, factor in factors.get(transaction.asset_id, ()):
            if day < event_day:
                quantity *= factor
        quantities[transaction.asset_id] += quantity
    # Somas de frações acumulam ruído de ponto flutuante (1.1411799999999999).
    return {asset_id: round(quantity, 8) for asset_id, quantity in quantities.items()}


def _status(statement: float, app: float) -> PositionMatch:
    has_statement = abs(statement) > QUANTITY_TOLERANCE
    has_app = abs(app) > QUANTITY_TOLERANCE
    if has_statement and not has_app:
        return PositionMatch.MISSING_IN_APP
    if has_app and not has_statement:
        return PositionMatch.MISSING_IN_STATEMENT
    if abs(statement - app) > QUANTITY_TOLERANCE:
        return PositionMatch.DIFFERENT
    return PositionMatch.MATCH


_ORDER = {
    PositionMatch.DIFFERENT: 0,
    PositionMatch.MISSING_IN_APP: 1,
    PositionMatch.MISSING_IN_STATEMENT: 2,
    PositionMatch.UNRESOLVED: 3,
    PositionMatch.MATCH: 4,
}


def compare_positions(
    holdings: Iterable[StatementHolding], app: dict[int, float]
) -> list[PositionDiff]:
    """Uma linha por ativo presente em qualquer um dos lados; divergências primeiro."""
    by_asset: dict[int, list[StatementHolding]] = defaultdict(list)
    diffs: list[PositionDiff] = []
    for holding in holdings:
        if holding.asset_id is None:
            diffs.append(
                PositionDiff(
                    key=f'holding:{holding.index}',
                    status=PositionMatch.UNRESOLVED,
                    asset_id=None,
                    statement_quantity=holding.quantity,
                    app_quantity=None,
                    difference=None,
                    holdings=(holding.index,),
                )
            )
        else:
            by_asset[holding.asset_id].append(holding)

    held = {asset_id: q for asset_id, q in app.items() if abs(q) > QUANTITY_TOLERANCE}
    for asset_id in sorted(set(by_asset) | set(held)):
        rows = by_asset.get(asset_id, [])
        statement = sum(row.quantity for row in rows)
        app_quantity = held.get(asset_id, 0.0)
        diffs.append(
            PositionDiff(
                key=f'asset:{asset_id}',
                status=_status(statement, app_quantity),
                asset_id=asset_id,
                statement_quantity=statement if rows else None,
                app_quantity=app_quantity if asset_id in held else None,
                difference=round(statement - app_quantity, 8),
                holdings=tuple(row.index for row in rows),
            )
        )
    return sorted(diffs, key=lambda diff: _ORDER[diff.status])


@dataclass(frozen=True, kw_only=True)
class DraftHolding:
    index: int
    security: str
    ticker: str | None
    quantity: float
    asset_id: int | None
    asset_name: str | None
    match: AssetMatch


@dataclass(frozen=True, kw_only=True)
class PositionStatementDraft:
    """O extrato lido e o diagnóstico contra a carteira. Não é gravado.

    O PDF em si é: `document_id` aponta para ele, ou é nulo quando não há
    storage configurado.
    """

    broker_name: str
    broker_cnpj: str | None
    broker_id: int | None
    currency: Currency
    as_of: date
    holdings: tuple[DraftHolding, ...]
    positions: tuple[PositionDiff, ...]
    warnings: tuple[NoteWarning, ...]
    model: str | None
    document_id: int | None = None
