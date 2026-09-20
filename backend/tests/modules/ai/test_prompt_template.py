"""A guarda que torna seguro editar prompt numa tela.

Se ela parar de disparar, um prompt que nomeia dado inexistente passa a ser
salvável, e a falha só aparece na frente de alguém, numa geração.
"""

import pytest

from app.core.exceptions import ValidationError
from app.modules.ai.domain.prompt_template import (
    assert_placeholders_known,
    placeholders,
    render,
)

pytestmark = pytest.mark.unit


def test_lists_every_placeholder_the_template_uses():
    assert placeholders('Olá {name}, sobre {ticker}') == frozenset({'name', 'ticker'})


def test_reports_a_nested_field_by_its_root():
    assert placeholders('{performance[cagr]} e {asset.name}') == frozenset({'performance', 'asset'})


def test_a_template_within_the_declared_keys_is_accepted():
    assert_placeholders_known('{ticker} em {exchange}', frozenset({'ticker', 'exchange'}))


def test_a_template_naming_data_nobody_assembles_is_refused():
    with pytest.raises(ValidationError) as error:
        assert_placeholders_known('{ticker} rende {dividend_yield}', frozenset({'ticker'}))

    message = str(error.value)
    assert '{dividend_yield}' in message
    # A mensagem diz o que existe, senão o autor do prompt fica adivinhando.
    assert 'ticker' in message


def test_rendering_fills_the_template():
    assert render('{ticker} na {exchange}', {'ticker': 'PETR4', 'exchange': 'B3'}) == 'PETR4 na B3'


def test_rendering_refuses_a_context_that_is_missing_a_key():
    with pytest.raises(ValidationError) as error:
        render('{ticker} e {performance}', {'ticker': 'PETR4'})

    assert '{performance}' in str(error.value)
