"""O formato em que o modelo devolve a leitura de uma nota de corretagem.

Todo campo é obrigatório; o que a nota pode não trazer é anulável, não tem
default. A imposição estrita de schema pede ao provedor que escreva toda chave
declarada, e um default deixaria uma chave ausente passar por escrita.

Nada aqui é confiável: é a leitura de um documento por um modelo. Os números que
a aplicação usa — custos por linha, conferências de total — são calculados em
`brokerage_note.py` a partir desta leitura, e não pedidos ao modelo.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BrokerageNoteLineReading(BaseModel):
    model_config = ConfigDict(extra='forbid')

    side: Literal['C', 'V'] = Field(
        description='C para compra (C, B, Buy), V para venda (V, S, Sell)'
    )
    market: str | None = Field(
        description='Tipo de mercado como escrito: VISTA, FRACIONARIO, OPCAO DE COMPRA…'
    )
    security: str = Field(description='A especificação ou descrição do título, como escrita')
    ticker: str | None = Field(description='O código de negociação, sem sufixos')
    fund_cnpj: str | None = Field(
        description='O CNPJ do fundo ou da classe, como impresso, quando a linha é de um fundo de investimento'
    )
    isin: str | None = Field(
        description='O ISIN da linha (12 caracteres, como IE00B5BMR087), só quando o documento o imprime'
    )
    quantity: float = Field(description='Quantidade, sempre positiva')
    price: float = Field(description='Preço unitário, na moeda da nota')
    value: float = Field(description='Valor bruto da linha, na moeda da nota, sempre positivo')
    fees: float | None = Field(
        description='Custos cobrados nesta linha, somados, quando o documento os detalha por linha'
    )


class BrokerageNoteReading(BaseModel):
    model_config = ConfigDict(extra='forbid')

    broker_name: str
    broker_cnpj: str | None
    currency: Literal['BRL', 'USD'] = Field(description='A moeda em que a nota é expressa')
    note_number: str | None
    trade_date: date = Field(description='Data do pregão')
    settlement_date: date | None = Field(description='A data do "Líquido para"')
    lines: list[BrokerageNoteLineReading]
    purchases_total: float | None = Field(description='Compras à vista')
    sales_total: float | None = Field(description='Vendas à vista')
    operations_total: float | None = Field(description='Valor das operações')
    settlement_fee: float | None = Field(description='Taxa de liquidação')
    registration_fee: float | None = Field(description='Taxa de registro')
    emoluments: float | None = Field(description='Emolumentos')
    other_exchange_fees: float | None = Field(
        description='Taxa de termo/opções e Taxa A.N.A., somadas'
    )
    brokerage: float | None = Field(
        description='Corretagem: Taxa operacional (ou Clearing/Corretagem) mais Execução'
    )
    iss: float | None = Field(description='ISS ou Impostos')
    other_costs: float | None = Field(description='Custódia e Outros, somados')
    withheld_income_tax: float | None = Field(
        description='O valor do I.R.R.F. s/ operações, não a base'
    )
    net_amount: float | None = Field(
        description='Líquido para: positivo quando é crédito ao cliente, negativo quando é débito'
    )


class BrokerageNotesReading(BaseModel):
    """Um PDF pode trazer uma nota por pregão; cada uma vem como uma entrada."""

    model_config = ConfigDict(extra='forbid')

    notes: list[BrokerageNoteReading]


class PositionStatementHoldingReading(BaseModel):
    model_config = ConfigDict(extra='forbid')

    security: str = Field(description='O nome ou a descrição do ativo, como escritos')
    ticker: str | None = Field(description='O código de negociação, sem sufixos')
    quantity: float = Field(description='Quantidade em custódia, positiva, com todas as casas')


class PositionStatementReading(BaseModel):
    """Um extrato de posição: o que a corretora diz que está custodiado numa data."""

    model_config = ConfigDict(extra='forbid')

    broker_name: str
    broker_cnpj: str | None
    currency: Literal['BRL', 'USD'] = Field(description='A moeda em que o extrato é expresso')
    as_of: date = Field(description='A data a que a posição se refere')
    holdings: list[PositionStatementHoldingReading]
