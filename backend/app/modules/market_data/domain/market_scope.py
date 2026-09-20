"""Onde um papel é negociado, quando o cadastro não diz.

A bolsa do ativo é a resposta certa, mas boa parte do cadastro entrou sem ela:
os ETFs americanos vieram todos com `exchange_id` nulo, e junto com eles um
punhado de ETFs da B3. Sem um segundo critério, a tela de ETFs EUA ou fica
vazia ou mostra NSDV11.

O ticker é esse critério, e ele é regra da própria B3: quatro letras seguidas
de um ou dois dígitos, com uma letra opcional no fim (PETR4, IVVB11, BOVA11,
PETR4F). Nenhum ticker americano tem esse formato.
"""

import re

#: O código da B3 no cadastro de bolsas. Escrito aqui, e não lido do enum
#: de bolsas, para que este módulo continue sem dependência nenhuma.
B3_EXCHANGE_CODE = 'B3'

#: O formato de ticker da B3. Ancorado nas duas pontas de propósito: sem isso
#: qualquer ticker que contenha um trecho parecido passaria.
B3_TICKER_PATTERN = r'^[A-Za-z]{4}[0-9]{1,2}[A-Za-z]?$'

_B3_TICKER = re.compile(B3_TICKER_PATTERN)


def is_b3_ticker(ticker: str | None) -> bool:
    """Se o ticker tem a forma de um papel negociado na B3."""
    return bool(ticker and _B3_TICKER.match(ticker))


def is_brazilian_market(exchange_code: str | None, ticker: str | None = None) -> bool:
    """Se o papel é do mercado brasileiro — a bolsa responde, o ticker socorre.

    A bolsa do ativo é a resposta certa, mas boa parte do cadastro entrou sem
    ela: os ETFs americanos vieram todos com `exchange_id` nulo, e junto com
    eles um punhado de ETFs da B3. Sem um segundo critério, a tela de ETFs EUA
    ou fica vazia ou mostra NSDV11.

    O ticker é esse critério, e ele é regra da própria B3. Só é consultado
    quando não há bolsa, então um ativo que o cadastro coloca numa praça
    continua sendo decidido por ela.

    Esta é a única definição de "brasileiro ou não" do domínio. O segmento da
    carteira e o informe de bens e direitos leem daqui, para que a mesma
    pergunta não ganhe duas respostas que possam divergir.
    """
    if exchange_code is not None:
        return exchange_code == B3_EXCHANGE_CODE
    # Sem ticker não há segundo critério, e o padrão continua sendo brasileiro:
    # é assim que o Tesouro e o CDB, que não têm código em bolsa nenhuma, são
    # registrados.
    return ticker is None or is_b3_ticker(ticker)
