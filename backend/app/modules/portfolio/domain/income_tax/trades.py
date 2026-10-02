"""Os fatos da apuração: cada operação, já com a natureza fiscal do ativo.

O tipo de ativo da tela não é a natureza fiscal. Um ETF de renda fixa e um de
ações dividem o tipo `ETF` e têm regimes diferentes; um Fiagro está cadastrado
como fundo de investimento e se apura com os FIIs; uma ação americana é ação e
não entra na apuração mensal da bolsa — vai para a apuração anual do exterior. `classify` é o único lugar que faz essa
tradução, e o que ela não sabe decidir sai como nota, para virar pendência.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum

from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY
from app.modules.market_data.domain.market_scope import is_b3_ticker, is_brazilian_market

#: O segmento "ETFs de Renda Fixa" do cadastro de ETFs.
FIXED_INCOME_ETF_SEGMENT_ID = 3


class TaxAssetKind(StrEnum):
    #: Ação no mercado à vista brasileiro.
    STOCK = 'stock'
    #: ETF brasileiro que não é de renda fixa: ações, índices, ouro, cripto.
    EQUITY_ETF = 'equity_etf'
    #: Tributado na fonte pelo administrador; não entra no DARF.
    FIXED_INCOME_ETF = 'fixed_income_etf'
    BDR = 'bdr'
    #: Cotas de FII e de Fiagro negociadas em bolsa.
    REAL_ESTATE_FUND = 'real_estate_fund'
    #: Criptoativo custodiado em corretora brasileira.
    CRYPTO = 'crypto'
    #: Fora da apuração mensal: exterior, renda fixa, Tesouro, previdência,
    #: fundos tributados na fonte.
    OUT_OF_SCOPE = 'out_of_scope'


class ClassificationNote(StrEnum):
    #: Ativo negociado fora do Brasil: regime anual de aplicações no exterior.
    FOREIGN = 'foreign'
    #: Criptoativo em corretora de base dólar: custódia no exterior.
    FOREIGN_CRYPTO = 'foreign_crypto'
    #: Fundo listado na B3 que não é FII nem Fiagro (FI-Infra, FIP...).
    LISTED_FUND = 'listed_fund'


@dataclass(frozen=True, kw_only=True)
class Classification:
    kind: TaxAssetKind
    note: ClassificationNote | None = None


@dataclass(frozen=True, kw_only=True)
class AssetFacts:
    """O que o cadastro diz do ativo e de onde ele está custodiado."""

    asset_type_id: int
    ticker: str | None
    exchange_code: str | None
    broker_currency_id: int | None
    etf_segment_id: int | None = None
    #: O tipo do fundo no cadastro do regulador (FII, FIAGRO, FIDC...).
    fund_kind: str | None = None

    @property
    def brazilian(self) -> bool:
        return is_brazilian_market(self.exchange_code, self.ticker)


_FOREIGN = Classification(kind=TaxAssetKind.OUT_OF_SCOPE, note=ClassificationNote.FOREIGN)


def _stock(facts: AssetFacts) -> Classification:
    return Classification(kind=TaxAssetKind.STOCK) if facts.brazilian else _FOREIGN


def _etf(facts: AssetFacts) -> Classification:
    if not facts.brazilian:
        return _FOREIGN
    if facts.etf_segment_id == FIXED_INCOME_ETF_SEGMENT_ID:
        return Classification(kind=TaxAssetKind.FIXED_INCOME_ETF)
    # Sem segmento no cadastro, o ETF brasileiro é de ações: é o caso comum, e
    # o usuário não tem como classificar o ativo (decisão de 01/10/2026).
    return Classification(kind=TaxAssetKind.EQUITY_ETF)


def _investment_fund(facts: AssetFacts) -> Classification:
    # Um Fiagro listado foi recadastrado como fundo de investimento, e é o
    # cadastro do regulador que diz que ele é Fiagro.
    if facts.fund_kind is not None and 'FIAGRO' in facts.fund_kind.upper():
        return Classification(kind=TaxAssetKind.REAL_ESTATE_FUND)
    if facts.exchange_code is not None or is_b3_ticker(facts.ticker):
        return Classification(kind=TaxAssetKind.OUT_OF_SCOPE, note=ClassificationNote.LISTED_FUND)
    return Classification(kind=TaxAssetKind.OUT_OF_SCOPE)


def _crypto(facts: AssetFacts) -> Classification:
    if facts.broker_currency_id == CURRENCY.BRL:
        return Classification(kind=TaxAssetKind.CRYPTO)
    return Classification(kind=TaxAssetKind.OUT_OF_SCOPE, note=ClassificationNote.FOREIGN_CRYPTO)


_BY_TYPE: dict[int, Callable[[AssetFacts], Classification]] = {
    ASSET_TYPE.STOCK: _stock,
    ASSET_TYPE.ETF: _etf,
    ASSET_TYPE.BDR: lambda _facts: Classification(kind=TaxAssetKind.BDR),
    ASSET_TYPE.FII: lambda _facts: Classification(kind=TaxAssetKind.REAL_ESTATE_FUND),
    ASSET_TYPE.FI: _investment_fund,
    ASSET_TYPE.CRIPTO: _crypto,
    ASSET_TYPE.REIT: lambda _facts: _FOREIGN,
}


def classify(facts: AssetFacts) -> Classification:
    classifier = _BY_TYPE.get(facts.asset_type_id)
    if classifier is None:
        # Renda fixa, Tesouro e previdência: o imposto é retido na fonte.
        return Classification(kind=TaxAssetKind.OUT_OF_SCOPE)
    return classifier(facts)


@dataclass(frozen=True, kw_only=True)
class TaxTrade:
    """Uma operação, em reais. Quantidade positiva é compra; negativa, venda."""

    transaction_id: int
    portfolio_id: int
    asset_id: int
    ticker: str
    kind: TaxAssetKind
    note: ClassificationNote | None = None
    broker_id: int
    day: date
    quantity: Decimal
    #: Preço unitário em reais, como a transação o guarda.
    price: Decimal
    #: Preço unitário em dólar, quando a transação o guarda. Só o exterior usa:
    #: a discriminação do bem pede o valor na moeda estrangeira.
    price_usd: Decimal | None = None
    #: Custos da operação. Nulo é "não informado", e é apurado como zero com
    #: pendência — não como custo zero conferido.
    fees: Decimal | None = None
    withheld_income_tax: Decimal | None = None

    @property
    def is_sale(self) -> bool:
        return self.quantity < 0


class EventType(StrEnum):
    SPLIT = 'SPLIT'
    REVERSE_SPLIT = 'REVERSE_SPLIT'
    BONUS = 'BONUS'


@dataclass(frozen=True, kw_only=True)
class CorporateEvent:
    """Desdobramento, grupamento ou bonificação, na data a partir da qual vale.

    O fator multiplica a quantidade de quem tinha o papel antes da data.
    """

    asset_id: int
    day: date
    type: str
    factor: Decimal
