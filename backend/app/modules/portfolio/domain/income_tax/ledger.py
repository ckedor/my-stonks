"""Custo médio e resultado de cada venda, ativo a ativo.

O custo é do contribuinte, não da carteira nem da corretora: comprar PETR4 em
duas corretoras forma um custo médio só, e é contra ele que qualquer venda se
mede. Por isso o livro recebe as operações de todas as carteiras juntas.

As taxas entram dos dois lados, como a regra manda: somam ao custo da compra e
saem do valor da venda. Taxa não informada é apurada como zero — e a venda sai
marcada, para a tela contar quantas estão assim.

Os eventos são aplicados uma vez, na ordem em que aconteceram: ao chegar a uma
operação da data do evento em diante, a posição já foi multiplicada pelo fator.
Um desdobramento muda a quantidade e não o custo total, e por isso não mexe no
resultado de venda nenhuma.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.modules.portfolio.domain.income_tax.pendency import Pendency, PendencyCode
from app.modules.portfolio.domain.income_tax.trades import (
    CorporateEvent,
    EventType,
    TaxAssetKind,
    TaxTrade,
)

#: Quantidades vêm de float e somam resíduo (0.30000000000000004). Abaixo
#: disto a posição acabou.
QUANTITY_TOLERANCE = Decimal('1e-8')

#: Naturezas que o livro acompanha. O resto sai antes: não tem apuração mensal.
LEDGER_KINDS = frozenset({
    TaxAssetKind.STOCK,
    TaxAssetKind.EQUITY_ETF,
    TaxAssetKind.FIXED_INCOME_ETF,
    TaxAssetKind.BDR,
    TaxAssetKind.REAL_ESTATE_FUND,
    TaxAssetKind.CRYPTO,
})

#: Onde há day trade: o que se negocia em bolsa.
_EXCHANGE_KINDS = frozenset({
    TaxAssetKind.STOCK,
    TaxAssetKind.EQUITY_ETF,
    TaxAssetKind.FIXED_INCOME_ETF,
    TaxAssetKind.BDR,
    TaxAssetKind.REAL_ESTATE_FUND,
})

_ZERO = Decimal(0)


@dataclass(frozen=True, kw_only=True)
class RealizedSale:
    transaction_id: int
    portfolio_id: int
    asset_id: int
    ticker: str
    kind: TaxAssetKind
    broker_id: int
    day: date
    #: Quantidade vendida, positiva.
    quantity: Decimal
    #: Quantidade vezes preço: é o que conta para os limites de isenção.
    gross_value: Decimal
    fees: Decimal
    #: Custo médio da posição vezes a quantidade vendida.
    cost: Decimal
    #: Valor da venda, menos taxas, menos custo.
    result: Decimal
    withheld_income_tax: Decimal
    #: Se a venda e todas as compras que formam o custo têm taxas informadas.
    fees_informed: bool


@dataclass
class _Position:
    quantity: Decimal = _ZERO
    cost: Decimal = _ZERO
    #: Alguma compra ainda na posição entrou sem taxas.
    missing_fees: bool = False

    def reset_if_empty(self) -> None:
        if abs(self.quantity) < QUANTITY_TOLERANCE:
            self.quantity = _ZERO
            self.cost = _ZERO
            self.missing_fees = False


def realize_sales(
    trades: Iterable[TaxTrade], events: Iterable[CorporateEvent]
) -> tuple[list[RealizedSale], list[Pendency]]:
    by_asset: dict[int, list[TaxTrade]] = defaultdict(list)
    for trade in trades:
        if trade.kind in LEDGER_KINDS:
            by_asset[trade.asset_id].append(trade)

    events_by_asset: dict[int, list[CorporateEvent]] = defaultdict(list)
    for event in events:
        events_by_asset[event.asset_id].append(event)

    sales: list[RealizedSale] = []
    pendencies: list[Pendency] = []
    for asset_id, asset_trades in by_asset.items():
        asset_sales, asset_pendencies = _realize_asset(
            sorted(asset_trades, key=lambda trade: (trade.day, trade.transaction_id)),
            sorted(events_by_asset.get(asset_id, ()), key=lambda event: event.day),
        )
        sales.extend(asset_sales)
        pendencies.extend(asset_pendencies)

    sales.sort(key=lambda sale: (sale.day, sale.transaction_id))
    return sales, pendencies


def _realize_asset(
    trades: list[TaxTrade], events: list[CorporateEvent]
) -> tuple[list[RealizedSale], list[Pendency]]:
    position = _Position()
    sales: list[RealizedSale] = []
    pendencies: list[Pendency] = []
    pending_events = list(events)
    ticker = trades[0].ticker

    for trade in trades:
        while pending_events and pending_events[0].day <= trade.day:
            event = pending_events.pop(0)
            pendency = _apply_event(position, event, ticker)
            if pendency is not None:
                pendencies.append(pendency)

        fees = trade.fees if trade.fees is not None else _ZERO
        if not trade.is_sale:
            position.quantity += trade.quantity
            position.cost += trade.quantity * trade.price + fees
            position.missing_fees = position.missing_fees or trade.fees is None
            continue

        sold = -trade.quantity
        held = position.quantity
        if sold > held + QUANTITY_TOLERANCE:
            pendencies.append(
                Pendency(
                    code=PendencyCode.SALE_WITHOUT_POSITION,
                    message=(
                        f'Venda de {_quantity(sold)} {ticker} com {_quantity(max(held, _ZERO))} '
                        'em posição. O custo da parte sem compra foi apurado como zero; '
                        'falta lançar alguma compra ou evento.'
                    ),
                    day=trade.day,
                    asset_id=trade.asset_id,
                    ticker=ticker,
                    transaction_ids=(trade.transaction_id,),
                )
            )
            cost = position.cost if held > _ZERO else _ZERO
            position.quantity = _ZERO
            position.cost = _ZERO
        else:
            cost = position.cost * sold / held
            position.quantity -= sold
            position.cost -= cost

        gross = sold * trade.price
        sales.append(
            RealizedSale(
                transaction_id=trade.transaction_id,
                portfolio_id=trade.portfolio_id,
                asset_id=trade.asset_id,
                ticker=ticker,
                kind=trade.kind,
                broker_id=trade.broker_id,
                day=trade.day,
                quantity=sold,
                gross_value=gross,
                fees=fees,
                cost=cost,
                result=gross - fees - cost,
                withheld_income_tax=trade.withheld_income_tax or _ZERO,
                fees_informed=trade.fees is not None and not position.missing_fees,
            )
        )
        position.reset_if_empty()

    return sales, pendencies


def _apply_event(position: _Position, event: CorporateEvent, ticker: str) -> Pendency | None:
    held = position.quantity
    position.quantity *= event.factor
    if held <= _ZERO:
        return None
    if event.type == EventType.BONUS:
        return Pendency(
            code=PendencyCode.BONUS_WITHOUT_COST,
            message=(
                f'Bonificação de {ticker}: as ações novas entraram com custo zero. '
                'O custo fiscal delas é o valor que a empresa atribuiu por ação; '
                'sem ele, o resultado das vendas seguintes sai maior.'
            ),
            day=event.day,
            asset_id=event.asset_id,
            ticker=ticker,
        )
    if event.type not in (EventType.SPLIT, EventType.REVERSE_SPLIT):
        return Pendency(
            code=PendencyCode.UNKNOWN_EVENT,
            message=(
                f'Evento "{event.type}" de {ticker}: o fator {event.factor} foi aplicado '
                'à quantidade, como num desdobramento. Confira se é isso.'
            ),
            day=event.day,
            asset_id=event.asset_id,
            ticker=ticker,
        )
    return None


def find_day_trades(trades: Iterable[TaxTrade]) -> list[Pendency]:
    """Compra e venda do mesmo ativo, no mesmo dia e na mesma corretora.

    A apuração trata essas operações como comuns — day trade tem alíquota,
    prejuízo e retenção próprios, e não está entre o que se opera aqui. A
    pendência existe para que um day trade não passe despercebido.
    """
    groups: dict[tuple[int, int, date], list[TaxTrade]] = defaultdict(list)
    for trade in trades:
        if trade.kind in _EXCHANGE_KINDS:
            groups[(trade.asset_id, trade.broker_id, trade.day)].append(trade)

    pendencies = []
    for (asset_id, _broker_id, day), group in sorted(
        groups.items(), key=lambda item: (item[0][2], item[1][0].ticker)
    ):
        if any(trade.is_sale for trade in group) and any(not trade.is_sale for trade in group):
            ticker = group[0].ticker
            pendencies.append(
                Pendency(
                    code=PendencyCode.DAY_TRADE,
                    message=(
                        f'Compra e venda de {ticker} no mesmo dia e corretora: é day trade, '
                        'que tem regime próprio (20%, prejuízo separado). Foi apurado como '
                        'operação comum.'
                    ),
                    day=day,
                    asset_id=asset_id,
                    ticker=ticker,
                    transaction_ids=tuple(trade.transaction_id for trade in group),
                )
            )
    return pendencies


def _quantity(value: Decimal) -> str:
    return format(value.normalize(), 'f')
