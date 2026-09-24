"""Nota de corretagem: rateio de custos, conferência e cruzamento com a carteira.

Tudo aqui é puro. O que entra é a leitura do modelo (`outputs.py`) e as
transações que a carteira já tem; o que sai é a proposta que a tela mostra antes
de qualquer escrita.

A nota não é a identidade de uma operação: não existe um código que a corretora,
a B3 e o lançamento manual compartilhem. Então reimportar uma nota é um
cruzamento por conteúdo — mesmo ativo, mesma corretora, mesmo dia, mesmo lado —
e o resultado é uma proposta, não uma decisão.
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field, replace
from datetime import date, datetime
from enum import StrEnum
from typing import Literal

from app.modules.portfolio.domain.entities import Transaction
from app.modules.portfolio.domain.outputs import BrokerageNoteReading

Side = Literal['C', 'V']
Currency = Literal['BRL', 'USD']
PURCHASE: Side = 'C'
SALE: Side = 'V'

#: Totais da nota vêm arredondados ao centavo; a soma das linhas, também. Acima
#: de um centavo e meio a diferença não é arredondamento, é leitura errada.
MONEY_TOLERANCE = 0.015
#: Preço de nota tem duas casas; o lançado à mão pode ter mais.
PRICE_TOLERANCE = 0.005
#: Um lançamento manual agregado guarda o preço médio, às vezes arredondado.
AVERAGE_PRICE_RELATIVE_TOLERANCE = 1e-4
QUANTITY_TOLERANCE = 1e-6

#: Um código B3: quatro letras e um ou dois dígitos. O fracionário é o mesmo
#: papel com um F no fim — PETR4F é PETR4 negociado em lote não padrão.
_B3_TOKEN = re.compile(r'^([A-Z]{4}\d{1,2})F?$')
#: Um ticker americano: até cinco letras, com classe opcional (BRK.B).
_US_TICKER = re.compile(r'^[A-Z]{1,5}(?:[.\-][A-Z])?$')


def normalize_ticker(text: str | None) -> str | None:
    """O primeiro código B3 que aparece no texto, sem o F do fracionário.

    O modelo nem sempre devolve só o código: a Nubank imprime "XPML11 CI ER"
    na especificação, e o que volta no campo pode vir com o sufixo junto.
    """
    for token in (text or '').upper().split():
        match = _B3_TOKEN.match(token.strip('.,;:()'))
        if match:
            return match.group(1)
    return None


def line_ticker(ticker: str | None, security: str | None, currency: Currency = 'BRL') -> str | None:
    """O código da linha: o que o modelo sugeriu, ou o que a especificação imprime.

    Numa nota em dólar o código é a coluna do símbolo, e só ela: procurar um
    ticker americano no meio da descrição acharia "TR", "II" ou "ETF".
    """
    if currency == 'USD':
        cleaned = (ticker or '').strip().upper()
        return cleaned if _US_TICKER.match(cleaned) else None
    return normalize_ticker(ticker) or normalize_ticker(security)


def _words(text: str | None) -> list[str]:
    return re.sub(r'[^0-9a-z]+', ' ', (text or '').lower()).split()


def match_broker(brokers: list, cnpj: str | None, name: str | None):
    """A corretora da nota: pelo CNPJ e, sem ele, pelo nome cadastrado.

    Uma confirmação americana não imprime CNPJ, e a corretora cadastrada tem o
    CNPJ da operação brasileira. O nome casa quando todas as palavras do nome
    cadastrado ("Nu Investimentos") aparecem no que a nota imprime, e só vale
    se uma corretora casar: duas é ambíguo, e a pessoa escolhe.
    """
    digits = only_digits(cnpj)
    if digits:
        by_cnpj = [broker for broker in brokers if only_digits(broker.cnpj) == digits]
        if by_cnpj:
            return by_cnpj[0]
    printed = set(_words(name))
    by_name = [
        broker for broker in brokers if (words := _words(broker.name)) and set(words) <= printed
    ]
    return by_name[0] if len(by_name) == 1 else None


def fund_key(cnpj: str | None) -> str | None:
    """A chave de um fundo entre os candidatos a ativo, que o ticker não dá.

    Prefixada, para um CNPJ nunca se confundir com um código de negociação.
    """
    return f'cnpj:{cnpj}' if cnpj else None


def only_digits(value: str | None) -> str | None:
    digits = re.sub(r'\D', '', value or '')
    return digits or None


def _note_level_costs(reading: BrokerageNoteReading) -> float:
    parts = (
        reading.settlement_fee,
        reading.registration_fee,
        reading.emoluments,
        reading.other_exchange_fees,
        reading.brokerage,
        reading.iss,
        reading.other_costs,
    )
    return round(sum(abs(part) for part in parts if part is not None), 2)


def note_costs(reading: BrokerageNoteReading) -> float:
    """Os custos da operação que a nota cobra, sem o IRRF — ele é imposto, não custo.

    Os do resumo e os que o documento detalha por linha, somados.
    """
    line_costs = sum(abs(line.fees) for line in reading.lines if line.fees is not None)
    return round(_note_level_costs(reading) + line_costs, 2)


def _line_value(quantity: float, price: float) -> float:
    return abs(quantity * price)


def _split_cents(total: float, weights: list[float]) -> list[float]:
    """Divide ``total`` proporcionalmente, em centavos, sem perder nem sobrar um.

    O maior resto fica com o centavo que o arredondamento deixou de fora, então a
    soma das partes é sempre o total da nota.
    """
    cents = round(total * 100)
    weight_sum = sum(weights)
    if not weights or weight_sum <= 0:
        return [0.0] * len(weights)
    raw = [cents * weight / weight_sum for weight in weights]
    floors = [int(part) for part in raw]
    leftover = cents - sum(floors)
    by_remainder = sorted(range(len(raw)), key=lambda i: raw[i] - floors[i], reverse=True)
    for index in by_remainder[:leftover]:
        floors[index] += 1
    return [floor / 100 for floor in floors]


def allocate_costs(reading: BrokerageNoteReading) -> list[tuple[float, float | None]]:
    """Custos e IRRF de cada linha da nota, na ordem das linhas.

    Os custos do resumo vão para todas as linhas pelo valor de cada uma, somados
    aos que o documento já cobrou na própria linha; o IRRF, só para as vendas —
    compra não retém imposto.
    """
    values = [_line_value(line.quantity, line.price) for line in reading.lines]
    shared = _split_cents(_note_level_costs(reading), values)
    fees = [
        round(part + abs(line.fees or 0.0), 2)
        for line, part in zip(reading.lines, shared, strict=True)
    ]

    sale_values = [
        value if line.side == SALE else 0.0
        for line, value in zip(reading.lines, values, strict=True)
    ]
    irrf_total = abs(reading.withheld_income_tax or 0.0)
    irrf = _split_cents(irrf_total, sale_values)
    return [
        (fee, tax if line.side == SALE else None)
        for line, fee, tax in zip(reading.lines, fees, irrf, strict=True)
    ]


@dataclass(frozen=True, kw_only=True)
class NoteWarning:
    code: str
    message: str


def check_note(reading: BrokerageNoteReading) -> list[NoteWarning]:
    """Confere a leitura contra os totais que a própria nota imprime.

    A nota se soma: cada linha é quantidade vezes preço, as linhas somam o valor
    das operações, e o líquido é vendas menos compras menos custos e IRRF. Uma
    conta que não fecha é o sinal de que o modelo leu algo errado — o único
    que a aplicação consegue dar sem outra fonte.
    """
    warnings: list[NoteWarning] = []

    for index, line in enumerate(reading.lines, start=1):
        computed = _line_value(line.quantity, line.price)
        if abs(computed - abs(line.value)) > MONEY_TOLERANCE:
            warnings.append(
                NoteWarning(
                    code='line_value',
                    message=(
                        f'Linha {index} ({line.security}): {line.quantity:g} x {line.price:.2f} '
                        f'= {computed:.2f}, mas a nota diz {abs(line.value):.2f}.'
                    ),
                )
            )

    lines_total = round(sum(abs(line.value) for line in reading.lines), 2)
    if (
        reading.operations_total is not None
        and abs(lines_total - abs(reading.operations_total)) > MONEY_TOLERANCE
    ):
        warnings.append(
            NoteWarning(
                code='operations_total',
                message=(
                    f'As linhas somam {lines_total:.2f}, mas o valor das operações da nota é '
                    f'{abs(reading.operations_total):.2f}. Pode haver linha faltando ou lida errado.'
                ),
            )
        )

    if reading.net_amount is not None:
        sales = sum(abs(line.value) for line in reading.lines if line.side == SALE)
        purchases = sum(abs(line.value) for line in reading.lines if line.side == PURCHASE)
        expected = round(
            sales - purchases - note_costs(reading) - abs(reading.withheld_income_tax or 0.0), 2
        )
        if abs(expected - reading.net_amount) > MONEY_TOLERANCE:
            warnings.append(
                NoteWarning(
                    code='net_amount',
                    message=(
                        f'Vendas - compras - custos - IRRF dá {expected:.2f}, mas o líquido da '
                        f'nota é {reading.net_amount:.2f}.'
                    ),
                )
            )
    return warnings


@dataclass(frozen=True, kw_only=True)
class NoteLine:
    """Uma linha da nota como seria gravada: ativo e corretora já escolhidos, ou não."""

    note_index: int
    line_index: int
    broker_id: int | None
    asset_id: int | None
    trade_date: date
    settlement_date: date | None
    side: Side
    quantity: float
    #: Na moeda da nota, que é a da corretora.
    price: float
    fees: float | None
    withheld_income_tax: float | None
    currency: Currency = 'BRL'

    @property
    def signed_quantity(self) -> float:
        return abs(self.quantity) if self.side == PURCHASE else -abs(self.quantity)


class GroupStatus(StrEnum):
    #: Nada lançado para o ativo, na corretora, no dia e no lado.
    NEW = 'new'
    #: Já lançado, linha por linha, com os mesmos custos e liquidação.
    UNCHANGED = 'unchanged'
    #: Já lançado linha por linha, faltando o que só a nota traz.
    UPDATE = 'update'
    #: Lançado à mão como um total só, que bate com a soma da nota.
    REPLACE = 'replace'
    #: Há lançamento, e ele diz outra coisa. Só quem operou sabe qual está certo.
    CONFLICT = 'conflict'
    #: Falta saber o ativo ou a corretora; sem eles não há o que cruzar.
    UNRESOLVED = 'unresolved'


class GroupAction(StrEnum):
    CREATE = 'create'
    UPDATE = 'update'
    REPLACE = 'replace'
    SKIP = 'skip'


@dataclass(frozen=True, kw_only=True)
class LineRef:
    note_index: int
    line_index: int


@dataclass(frozen=True, kw_only=True)
class LineUpdate:
    """Uma linha da nota que já existe como transação e só ganha os campos da nota."""

    line: LineRef
    transaction_id: int


@dataclass(frozen=True, kw_only=True)
class ReconciliationGroup:
    key: str
    status: GroupStatus
    default_action: GroupAction
    actions: tuple[GroupAction, ...]
    broker_id: int | None
    asset_id: int | None
    trade_date: date
    side: Side
    lines: tuple[LineRef, ...]
    existing_ids: tuple[int, ...]
    updates: tuple[LineUpdate, ...] = ()
    message: str | None = None
    warnings: tuple[str, ...] = field(default_factory=tuple)


def group_key(broker_id: int, asset_id: int, trade_date: date, side: Side) -> str:
    return f'{broker_id}:{asset_id}:{trade_date.isoformat()}:{side}'


def _day(value) -> date:
    return value.date() if hasattr(value, 'date') and callable(value.date) else value


def _price_in(transaction: Transaction, currency: Currency) -> float:
    """O preço da transação na moeda da nota: ``price`` é sempre em reais."""
    if currency == 'USD' and transaction.price_usd is not None:
        return transaction.price_usd
    return transaction.price


def _same_price(a: float, b: float) -> bool:
    return abs(a - b) <= PRICE_TOLERANCE


def _same_quantity(a: float, b: float) -> bool:
    return abs(a - b) <= QUANTITY_TOLERANCE


def _same_average_price(a: float, b: float) -> bool:
    return abs(a - b) <= PRICE_TOLERANCE or abs(a - b) <= abs(b) * AVERAGE_PRICE_RELATIVE_TOLERANCE


def _average_price(pairs: list[tuple[float, float]]) -> float:
    quantity = sum(abs(q) for q, _ in pairs)
    return sum(abs(q) * p for q, p in pairs) / quantity if quantity else 0.0


def _pair_line_by_line(
    lines: list[NoteLine], existing: list[Transaction]
) -> list[tuple[NoteLine, Transaction]] | None:
    """As linhas e as transações formam o mesmo conjunto? Então, em que pares."""
    if len(lines) != len(existing):
        return None
    currency = lines[0].currency
    by_line = sorted(lines, key=lambda line: (line.signed_quantity, line.price))
    by_transaction = sorted(existing, key=lambda t: (t.quantity, _price_in(t, currency)))
    pairs = list(zip(by_line, by_transaction, strict=True))
    for line, transaction in pairs:
        if not (
            _same_quantity(line.signed_quantity, transaction.quantity)
            and _same_price(line.price, _price_in(transaction, currency))
        ):
            return None
    return pairs


def _lacks_note_fields(line: NoteLine, transaction: Transaction) -> bool:
    def differs(a: float | None, b: float | None) -> bool:
        if a is None:
            return False
        return b is None or abs(a - b) > PRICE_TOLERANCE

    return (
        differs(line.fees, transaction.fees)
        or differs(line.withheld_income_tax, transaction.withheld_income_tax)
        or (
            line.settlement_date is not None and line.settlement_date != transaction.settlement_date
        )
    )


def _ref(line: NoteLine) -> LineRef:
    return LineRef(note_index=line.note_index, line_index=line.line_index)


def _classify(
    key: str,
    lines: list[NoteLine],
    same_broker: list[Transaction],
    other_broker: list[Transaction],
) -> ReconciliationGroup:
    first = lines[0]
    base = {
        'key': key,
        'broker_id': first.broker_id,
        'asset_id': first.asset_id,
        'trade_date': first.trade_date,
        'side': first.side,
        'lines': tuple(_ref(line) for line in lines),
    }
    note_quantity = sum(line.signed_quantity for line in lines)

    if not same_broker:
        other_quantity = sum(t.quantity for t in other_broker)
        if other_broker and _same_quantity(other_quantity, note_quantity):
            return ReconciliationGroup(
                **base,
                status=GroupStatus.CONFLICT,
                default_action=GroupAction.SKIP,
                actions=(GroupAction.SKIP, GroupAction.CREATE),
                existing_ids=tuple(t.id for t in other_broker),
                message=(
                    'A mesma quantidade já está lançada neste dia em outra corretora. '
                    'Provavelmente é esta operação com a corretora errada.'
                ),
            )
        return ReconciliationGroup(
            **base,
            status=GroupStatus.NEW,
            default_action=GroupAction.CREATE,
            actions=(GroupAction.CREATE, GroupAction.SKIP),
            existing_ids=(),
        )

    existing_ids = tuple(t.id for t in same_broker)
    pairs = _pair_line_by_line(lines, same_broker)
    if pairs is not None:
        updates = tuple(
            LineUpdate(line=_ref(line), transaction_id=transaction.id)
            for line, transaction in pairs
            if _lacks_note_fields(line, transaction)
        )
        if updates:
            return ReconciliationGroup(
                **base,
                status=GroupStatus.UPDATE,
                default_action=GroupAction.UPDATE,
                actions=(GroupAction.UPDATE, GroupAction.SKIP),
                existing_ids=existing_ids,
                updates=updates,
                message='Já lançada. A nota completa custos, IRRF e liquidação.',
            )
        return ReconciliationGroup(
            **base,
            status=GroupStatus.UNCHANGED,
            default_action=GroupAction.SKIP,
            actions=(GroupAction.SKIP,),
            existing_ids=existing_ids,
            message='Já lançada, igual à nota.',
        )

    existing_quantity = sum(t.quantity for t in same_broker)
    same_total = _same_quantity(existing_quantity, note_quantity) and _same_average_price(
        _average_price([(t.quantity, _price_in(t, first.currency)) for t in same_broker]),
        _average_price([(line.quantity, line.price) for line in lines]),
    )
    if same_total:
        return ReconciliationGroup(
            **base,
            status=GroupStatus.REPLACE,
            default_action=GroupAction.REPLACE,
            actions=(GroupAction.REPLACE, GroupAction.SKIP),
            existing_ids=existing_ids,
            message=(
                f'Lançada como {len(same_broker)} transação(ões) com o mesmo total e preço médio. '
                f'Substituir pelas {len(lines)} linha(s) da nota.'
            ),
        )
    return ReconciliationGroup(
        **base,
        status=GroupStatus.CONFLICT,
        default_action=GroupAction.SKIP,
        actions=(GroupAction.SKIP, GroupAction.REPLACE, GroupAction.CREATE),
        existing_ids=existing_ids,
        message=(
            f'Já há {existing_quantity:g} lançado(s) neste dia e corretora; a nota diz '
            f'{note_quantity:g}. Substituir apaga o lançado; criar soma as duas.'
        ),
    )


def _unresolved(line: NoteLine) -> ReconciliationGroup:
    missing = 'o ativo' if line.asset_id is None else 'a corretora'
    return ReconciliationGroup(
        key=f'unresolved:{line.note_index}:{line.line_index}',
        status=GroupStatus.UNRESOLVED,
        default_action=GroupAction.SKIP,
        actions=(GroupAction.SKIP,),
        broker_id=line.broker_id,
        asset_id=line.asset_id,
        trade_date=line.trade_date,
        side=line.side,
        lines=(_ref(line),),
        existing_ids=(),
        message=f'Escolha {missing} para cruzar esta linha com a carteira.',
    )


def reconcile(lines: list[NoteLine], existing: list[Transaction]) -> list[ReconciliationGroup]:
    """Cruza as linhas da nota com as transações da carteira.

    ``existing`` são as transações dos ativos da nota até o último pregão dela,
    em qualquer corretora: as do mesmo dia decidem o status, as anteriores
    dão a posição de onde cada venda parte.
    """
    grouped: dict[str, list[NoteLine]] = defaultdict(list)
    groups: list[ReconciliationGroup] = []
    for line in lines:
        if line.asset_id is None or line.broker_id is None:
            groups.append(_unresolved(line))
            continue
        grouped[group_key(line.broker_id, line.asset_id, line.trade_date, line.side)].append(line)

    for key, group_lines in grouped.items():
        first = group_lines[0]
        same_day = [
            t
            for t in existing
            if t.asset_id == first.asset_id
            and _day(t.date) == first.trade_date
            and (t.quantity > 0) == (first.side == PURCHASE)
        ]
        groups.append(
            _classify(
                key,
                group_lines,
                same_broker=[t for t in same_day if t.broker_id == first.broker_id],
                other_broker=[t for t in same_day if t.broker_id != first.broker_id],
            )
        )

    groups = [_with_position_warning(group, groups, lines, existing) for group in groups]
    return sorted(groups, key=lambda g: (min((r.note_index, r.line_index) for r in g.lines)))


def _with_position_warning(
    group: ReconciliationGroup,
    groups: list[ReconciliationGroup],
    lines: list[NoteLine],
    existing: list[Transaction],
) -> ReconciliationGroup:
    """Avisa quando uma venda deixaria a posição negativa, contando o que a nota cria.

    É aviso e não bloqueio: uma carteira com a compra ainda não lançada chega
    aqui assim, e o import é justamente como ela vai ser lançada.
    """
    if group.side != SALE or group.asset_id is None or group.status == GroupStatus.UNRESOLVED:
        return group

    created = {
        (ref.note_index, ref.line_index)
        for other in groups
        if other.default_action == GroupAction.CREATE
        for ref in other.lines
    }
    note_lines = [
        line
        for line in lines
        if line.asset_id == group.asset_id and (line.note_index, line.line_index) in created
    ]
    before = sum(
        t.quantity
        for t in existing
        if t.asset_id == group.asset_id and _day(t.date) < group.trade_date
    ) + sum(line.signed_quantity for line in note_lines if line.trade_date < group.trade_date)
    same_day_purchases = sum(
        t.quantity
        for t in existing
        if t.asset_id == group.asset_id and _day(t.date) == group.trade_date and t.quantity > 0
    ) + sum(
        line.signed_quantity
        for line in note_lines
        if line.trade_date == group.trade_date and line.side == PURCHASE
    )
    sold = sum(
        line.signed_quantity
        for line in lines
        if LineRef(note_index=line.note_index, line_index=line.line_index) in group.lines
    )
    after = before + same_day_purchases + sold
    if after >= -QUANTITY_TOLERANCE:
        return group
    warning = (
        f'A venda deixa a posição em {after:g}: falta lançar compra anterior, '
        'ou o ativo escolhido não é o certo.'
    )
    return replace(group, warnings=(*group.warnings, warning))


class AssetMatch(StrEnum):
    """Se o ticker que o modelo sugeriu é um ativo do cadastro, como no research."""

    MATCHED = 'matched'
    UNKNOWN = 'unknown'
    AMBIGUOUS = 'ambiguous'


@dataclass(frozen=True, kw_only=True)
class NoteAmounts:
    """Os totais, custos e o líquido como a nota os imprime."""

    purchases_total: float | None = None
    sales_total: float | None = None
    operations_total: float | None = None
    settlement_fee: float | None = None
    registration_fee: float | None = None
    emoluments: float | None = None
    other_exchange_fees: float | None = None
    brokerage: float | None = None
    iss: float | None = None
    other_costs: float | None = None
    withheld_income_tax: float | None = None
    net_amount: float | None = None

    @classmethod
    def read_from(cls, reading: BrokerageNoteReading) -> 'NoteAmounts':
        return cls(**{name: getattr(reading, name) for name in cls.__dataclass_fields__})


@dataclass(frozen=True, kw_only=True)
class NoteHeader:
    """A nota que a pessoa confirma: a corretora escolhida e o que ela imprime."""

    broker_id: int | None
    currency: Currency
    note_number: str | None
    trade_date: date
    settlement_date: date | None
    amounts: NoteAmounts


@dataclass(frozen=True, kw_only=True)
class DraftLine:
    index: int
    side: Side
    market: str | None
    security: str
    ticker: str | None
    quantity: float
    price: float
    value: float
    fees: float
    withheld_income_tax: float | None
    asset_id: int | None
    asset_name: str | None
    match: AssetMatch


@dataclass(frozen=True, kw_only=True)
class DraftNote:
    """Uma nota lida, com o cruzamento das suas linhas contra a carteira.

    Cada nota se confirma sozinha, então cada uma traz o próprio cruzamento.
    ``imported_note_id`` diz que esta nota (mesma corretora e número) já foi
    importada nesta carteira: confirmar de novo a atualiza.
    """

    index: int
    broker_name: str
    broker_cnpj: str | None
    broker_id: int | None
    currency: Currency
    note_number: str | None
    trade_date: date
    settlement_date: date | None
    amounts: NoteAmounts
    fees: float
    warnings: tuple[NoteWarning, ...]
    lines: tuple[DraftLine, ...]
    groups: tuple[ReconciliationGroup, ...]
    imported_note_id: int | None = None
    imported_at: datetime | None = None


@dataclass(frozen=True, kw_only=True)
class BrokerageNoteDraft:
    """O que o PDF virou, antes de alguém concordar com isso. Não é gravado."""

    notes: tuple[DraftNote, ...]
    model: str | None


@dataclass(frozen=True, kw_only=True)
class GroupDecision:
    """O que a pessoa escolheu para um grupo, e sobre quais transações ela decidiu."""

    key: str
    action: GroupAction
    existing_ids: tuple[int, ...]


@dataclass(frozen=True, kw_only=True)
class ImportResult:
    note_id: int
    created: int
    updated: int
    deleted: int
    asset_ids: tuple[int, ...]
