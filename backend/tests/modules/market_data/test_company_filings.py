"""As guardas do formulário cadastral, contra o que os arquivos reais trazem.

Cada caso aqui saiu de uma linha que existe de verdade nos arquivos da CVM, e
não de um cenário imaginado. O código de negociação é texto livre e os filers
abusam dele; o arquivo carrega papel que saiu da bolsa há décadas; e o cadastro
de companhias repete linha. Nenhuma das três coisas é hipótese.
"""

import csv
import zipfile
from datetime import date
from pathlib import Path

import pytest

from app.infra.exceptions import IntegrationBadResponse
from app.modules.market_data.adapters.company_filings import (
    COMPANY_COLUMNS,
    SECURITY_COLUMNS,
    iter_company_rows,
    iter_security_rows,
    latest_companies,
    latest_securities,
)

pytestmark = pytest.mark.unit


def _write_csv(path: Path, columns, rows) -> Path:
    with path.open('w', encoding='latin-1', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(columns), delimiter=';')
        writer.writeheader()
        writer.writerows(rows)
    return path


def _company(**overrides) -> dict:
    row = {
        'CNPJ_CIA': '33.000.167/0001-01',
        'DENOM_SOCIAL': 'PETRÓLEO BRASILEIRO S.A. - PETROBRAS',
        'DENOM_COMERC': 'PETROBRAS',
        'CD_CVM': '9512',
        'SIT': 'ATIVO',
        'DT_REG': '1977-07-20',
    }
    return {**row, **overrides}


def _security(**overrides) -> dict:
    row = {
        'CNPJ_Companhia': '33.000.167/0001-01',
        'Valor_Mobiliario': 'Ações Preferenciais',
        'Sigla_Classe_Acao_Preferencial': '',
        'Codigo_Negociacao': 'PETR4',
        'Mercado': 'Bolsa',
        'Segmento': 'Nível 2 de Governança Corporativa',
        'Data_Fim_Negociacao': '',
        'Data_Referencia': '2026-01-01',
        'Versao': '1',
    }
    return {**row, **overrides}


def _securities_zip(path: Path, rows) -> Path:
    member = Path(path.parent, 'fca_cia_aberta_valor_mobiliario_2026.csv')
    _write_csv(member, SECURITY_COLUMNS, rows)
    with zipfile.ZipFile(path, 'w') as archive:
        archive.write(member, member.name)
    return path


# --- o header é conferido contra o arquivo, não contra o dicionário ----------


def test_a_company_file_missing_a_column_fails_the_file(tmp_path):
    columns = [column for column in COMPANY_COLUMNS if column != 'CD_CVM']
    row = _company()
    path = _write_csv(tmp_path / 'cad.csv', columns, [{k: row[k] for k in columns}])

    with pytest.raises(IntegrationBadResponse, match='CD_CVM'):
        list(iter_company_rows(path))


def test_a_securities_file_missing_a_column_fails_the_file(tmp_path):
    columns = [column for column in SECURITY_COLUMNS if column != 'Segmento']
    row = _security()
    _write_csv(
        tmp_path / 'fca_cia_aberta_valor_mobiliario_2026.csv',
        columns,
        [{k: row[k] for k in columns}],
    )
    archive = tmp_path / 'fca.zip'
    with zipfile.ZipFile(archive, 'w') as zf:
        zf.write(
            tmp_path / 'fca_cia_aberta_valor_mobiliario_2026.csv',
            'fca_cia_aberta_valor_mobiliario_2026.csv',
        )

    with pytest.raises(IntegrationBadResponse, match='Segmento'):
        list(iter_security_rows(archive))


# --- o código de negociação é texto livre, e vem sujo -----------------------


@pytest.mark.parametrize(
    'code',
    [
        'ADR',  # o que a Marfrig escreveu
        '4030',  # o que a CSN escreveu
        '000000',  # o que o BTG Pactual escreveu
        '',
    ],
)
def test_a_code_that_is_not_a_b3_ticker_is_dropped(tmp_path, code):
    """Um valor de lixo não identifica ativo, e poderia identificar o errado."""
    archive = _securities_zip(tmp_path / 'fca.zip', [_security(Codigo_Negociacao=code)])

    assert list(iter_security_rows(archive)) == []


def test_a_real_ticker_survives_with_its_class_and_segment(tmp_path):
    archive = _securities_zip(tmp_path / 'fca.zip', [_security()])

    (row,) = list(iter_security_rows(archive))

    assert row['ticker'] == 'PETR4'
    assert row['cnpj'] == '33000167000101'
    assert row['share_class'] == 'PN'
    assert row['listing_segment'] == 'Nível 2 de Governança Corporativa'


def test_the_full_preferred_class_wins_over_the_generic_species(tmp_path):
    """`PNA` é mais específico que "Ações Preferenciais", e é o que o arquivo dá."""
    archive = _securities_zip(
        tmp_path / 'fca.zip',
        [_security(Codigo_Negociacao='BRKM5', Sigla_Classe_Acao_Preferencial='PNA')],
    )

    (row,) = list(iter_security_rows(archive))

    assert row['share_class'] == 'PNA'


def test_a_debenture_is_not_a_share_and_does_not_become_one(tmp_path):
    archive = _securities_zip(
        tmp_path / 'fca.zip',
        [_security(Valor_Mobiliario='Debêntures', Codigo_Negociacao='RDVT11')],
    )

    assert list(iter_security_rows(archive)) == []


# --- a revisão mais nova vence, e a mais velha só preenche lacuna ------------


def test_the_newest_revision_wins_over_an_older_one():
    rows = [
        {
            'ticker': 'PETR4',
            'reference_date': date(2026, 1, 1),
            'version': 1,
            'listing_segment': 'Básico',
        },
        {
            'ticker': 'PETR4',
            'reference_date': date(2026, 1, 1),
            'version': 2,
            'listing_segment': 'Novo Mercado',
        },
    ]

    assert latest_securities(rows)['PETR4']['listing_segment'] == 'Novo Mercado'


def test_an_older_year_does_not_overwrite_a_newer_one_whatever_the_order():
    """A EMBR3 só existe nos formulários antigos: ano velho preenche, não sobrescreve."""
    novo = {'ticker': 'PETR4', 'reference_date': date(2026, 1, 1), 'version': 1}
    velho = {'ticker': 'PETR4', 'reference_date': date(2022, 1, 1), 'version': 9}
    antiga = {'ticker': 'EMBR3', 'reference_date': date(2022, 1, 1), 'version': 1}

    latest = latest_securities([velho, novo, antiga])

    assert latest['PETR4']['reference_date'] == date(2026, 1, 1)
    assert latest['EMBR3']['reference_date'] == date(2022, 1, 1)


# --- o cadastro de companhias repete linha ----------------------------------


def test_a_repeated_cnpj_becomes_one_legal_entity(tmp_path):
    """2.677 linhas carregam 2.530 CNPJs: as repetidas são idênticas."""
    path = _write_csv(tmp_path / 'cad.csv', COMPANY_COLUMNS, [_company(), _company()])

    assert len(latest_companies(iter_company_rows(path))) == 1


def test_an_open_registration_wins_over_a_cancelled_one_for_the_same_cnpj(tmp_path):
    path = _write_csv(
        tmp_path / 'cad.csv',
        COMPANY_COLUMNS,
        [_company(SIT='CANCELADA'), _company(SIT='ATIVO')],
    )

    (row,) = latest_companies(iter_company_rows(path))

    assert row['status'] == 'ATIVO'


def test_a_partial_cnpj_never_becomes_a_legal_entity(tmp_path):
    """O CNPJ é a identidade: um parcial criaria linha que nada casa depois."""
    path = _write_csv(tmp_path / 'cad.csv', COMPANY_COLUMNS, [_company(CNPJ_CIA='33.000.167')])

    assert list(iter_company_rows(path)) == []


def test_the_trade_name_is_preferred_and_the_legal_name_is_the_fallback(tmp_path):
    path = _write_csv(
        tmp_path / 'cad.csv',
        COMPANY_COLUMNS,
        [_company(), _company(CNPJ_CIA='07.689.002/0001-89', DENOM_COMERC='')],
    )

    rows = {row['cnpj']: row for row in iter_company_rows(path)}

    assert rows['33000167000101']['name'] == 'PETROBRAS'
    assert rows['07689002000189']['name'] == 'PETRÓLEO BRASILEIRO S.A. - PETROBRAS'
