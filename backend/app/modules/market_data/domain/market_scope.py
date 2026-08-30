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

#: O formato de ticker da B3. Ancorado nas duas pontas de propósito: sem isso
#: qualquer ticker que contenha um trecho parecido passaria.
B3_TICKER_PATTERN = r'^[A-Za-z]{4}[0-9]{1,2}[A-Za-z]?$'

_B3_TICKER = re.compile(B3_TICKER_PATTERN)


def is_b3_ticker(ticker: str | None) -> bool:
    """Se o ticker tem a forma de um papel negociado na B3."""
    return bool(ticker and _B3_TICKER.match(ticker))
