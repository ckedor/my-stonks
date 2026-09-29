"""O que a apuração não conseguiu decidir sozinha, dito à pessoa.

Uma pendência não trava a apuração: o número sai, com a premissa que foi usada,
e a pendência diz qual foi e o que fazer. Falta de dado nunca é tratada em
silêncio como zero ou como isenção.
"""

from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum


class PendencyCode(StrEnum):
    #: Venda maior do que a posição que o histórico mostra.
    SALE_WITHOUT_POSITION = 'sale_without_position'
    #: Bonificação: as ações novas entraram sem custo.
    BONUS_WITHOUT_COST = 'bonus_without_cost'
    #: Evento de tipo que a apuração não conhece; o fator foi aplicado.
    UNKNOWN_EVENT = 'unknown_event'
    #: Vendas cujo custo ou a própria venda não tem taxas informadas.
    MISSING_FEES = 'missing_fees'
    #: Compra e venda do mesmo ativo, no mesmo dia e corretora.
    DAY_TRADE = 'day_trade'
    ETF_WITHOUT_SEGMENT = 'etf_without_segment'
    FOREIGN_SALE = 'foreign_sale'
    FOREIGN_CRYPTO_SALE = 'foreign_crypto_sale'
    LISTED_FUND_SALE = 'listed_fund_sale'
    #: Venda num período que o catálogo de regras não cobre.
    NO_RULE = 'no_rule'
    #: Pagamento registrado para um período sem DARF a pagar.
    PAYMENT_WITHOUT_OBLIGATION = 'payment_without_obligation'
    #: Bem ou rendimento que a declaração pede, mas que nenhuma ficha daqui cobre.
    NOT_DECLARED_HERE = 'not_declared_here'


@dataclass(frozen=True, kw_only=True)
class Pendency:
    code: PendencyCode
    message: str
    day: date | None = None
    asset_id: int | None = None
    ticker: str | None = None
    transaction_ids: tuple[int, ...] = field(default_factory=tuple)
