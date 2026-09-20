"""O CNPJ e a praça do informe de bens e direitos.

Duas coisas que o informe errava e que passavam despercebidas por um ano
inteiro, porque ninguém confere uma declaração linha a linha:

- o CNPJ era o da corretora em toda ficha, inclusive nas de fundo e de ação,
  onde o campo pede o emissor;
- Brasil ou exterior saía da moeda da **corretora**, então uma ação brasileira
  comprada por corretora de base dólar era declarada como ação no exterior.

Os dois casos de NaN e de renda fixa não são hipóteses: apareceram ao rodar o
informe contra a carteira real.
"""

import numpy as np
import pytest

from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY
from app.modules.portfolio.service.portfolio_income_tax_service import (
    PortfolioIncomeTaxService,
)

pytestmark = pytest.mark.unit

_SERVICE = PortfolioIncomeTaxService


def _row(**overrides) -> dict:
    row = {
        'type_id': ASSET_TYPE.STOCK,
        'currency_id': CURRENCY.BRL,
        'ticker': 'PETR4',
        'exchange_code': 'B3',
        'issuer_cnpj': '33000167000101',
        'fund_cnpj': None,
        'broker_cnpj': '62.169.875/0001-79',
        'name': 'Petrobras',
        'broker_name': 'Corretora',
    }
    return {**row, **overrides}


# --- F1: o CNPJ é o do emissor, não o da corretora --------------------------


def test_a_stock_declares_the_company_that_issued_it():
    assert _SERVICE._map_cnpj(_row()) == '33.000.167/0001-01'


def test_a_real_estate_fund_declares_its_own_cnpj():
    row = _row(type_id=ASSET_TYPE.FII, ticker='MXRF11', fund_cnpj='97521225000125')

    assert _SERVICE._map_cnpj(row) == '97.521.225/0001-25'


def test_fixed_income_keeps_declaring_the_broker():
    """Num CDB o campo pede mesmo a instituição onde o papel está custodiado."""
    row = _row(type_id=ASSET_TYPE.CDB, ticker='CDB C6 12/02/2027', exchange_code=None)

    assert _SERVICE._map_cnpj(row) == '62.169.875/0001-79'


def test_a_fund_with_no_registry_link_falls_back_to_the_broker():
    """Sem vínculo não há CNPJ do fundo, e o informe não pode sair vazio."""
    row = _row(type_id=ASSET_TYPE.ETF, ticker='NSDV11', fund_cnpj=None)

    assert _SERVICE._map_cnpj(row) == '62.169.875/0001-79'


def test_the_same_document_is_punctuated_wherever_it_came_from():
    """O registro guarda só dígitos e a corretora guarda pontuado.

    Sem normalizar, o mesmo informe sai com os dois formatos misturados.
    """
    fund = _SERVICE._map_cnpj(_row(type_id=ASSET_TYPE.FII, fund_cnpj='97521225000125'))
    broker = _SERVICE._map_cnpj(_row(type_id=ASSET_TYPE.CDB, exchange_code=None))

    assert fund.count('.') == broker.count('.') == 2
    assert fund.count('/') == broker.count('/') == 1


# --- F2: a praça é do ativo, não da corretora -------------------------------


def test_a_brazilian_stock_bought_through_a_dollar_broker_is_still_brazilian():
    """Era isto que a moeda da corretora errava."""
    row = _row(currency_id=CURRENCY.USD)

    assert _SERVICE._map_group(row) == '03'
    assert _SERVICE._map_code(row) == '01'
    assert _SERVICE._map_locale(row) == '105'


def test_a_foreign_stock_bought_through_a_real_broker_is_still_foreign():
    row = _row(ticker='MSFT', exchange_code='NASDAQ', currency_id=CURRENCY.BRL)

    assert _SERVICE._map_group(row) == '04'
    assert _SERVICE._map_locale(row) == '249'


def test_an_asset_with_no_exchange_is_decided_by_the_shape_of_its_ticker():
    """A mesma rede que o segmento usa: nenhum ticker americano tem forma da B3."""
    assert _SERVICE._is_brazilian(_row(ticker='PETR4', exchange_code=None)) is True
    assert _SERVICE._is_brazilian(_row(ticker='QQQM', exchange_code=None)) is False


def test_fixed_income_is_brazilian_even_with_a_descriptive_ticker():
    """`CDB C6 12/02/2027` não tem forma de código da B3, e não deveria ter.

    Renda fixa e Tesouro não têm praça: passá-los pela regra de mercado os
    mandava para o exterior.
    """
    for asset_type in (ASSET_TYPE.CDB, ASSET_TYPE.CRA, ASSET_TYPE.TREASURY, ASSET_TYPE.LCA):
        row = _row(type_id=asset_type, ticker='CDB C6 12/02/2027', exchange_code=None)

        assert _SERVICE._is_brazilian(row) is True
        assert _SERVICE._map_locale(row) == '105'


def test_a_missing_exchange_from_the_year_merge_is_not_read_as_foreign():
    """O merge dos dois anos deixa NaN, e NaN não é None.

    Sem tratar, a comparação com o código da bolsa dá falso e o mesmo FII
    aparecia duas vezes no informe, uma como 105 e outra como 249, só porque
    uma das corretoras tinha posição num ano só.
    """
    row = _row(type_id=ASSET_TYPE.FII, ticker='XPML11', exchange_code=np.nan)

    assert _SERVICE._is_brazilian(row) is True
    assert _SERVICE._map_locale(row) == '105'
