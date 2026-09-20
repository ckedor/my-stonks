from datetime import date
from decimal import Decimal

import pytest

from app.infra.exceptions import IntegrationBadResponse
from app.modules.market_data.adapters.fund_filings import (
    iter_fund_batches,
    scan_share_value_filings,
)
from app.modules.market_data.domain.fund_share_value import ShareValueDataset
from tests.fixtures.cvm import (
    DAILY_HEADER,
    FIDC_HEADER,
    PLGN_CLASS,
    PLGN_FUND,
    csv_bytes,
    registry_zip,
    zipped,
)

OTHER_FUND = PLGN_FUND.replace('13812;55139905000139', '627;16671412000193')


def test_a_fund_repeated_out_of_order_fails_instead_of_losing_a_manager(tmp_path):
    path = tmp_path / 'registro_fundo_classe.zip'
    path.write_bytes(
        registry_zip(funds=[PLGN_FUND, OTHER_FUND, PLGN_FUND], classes=[PLGN_CLASS], subclasses=[])
    )

    with pytest.raises(IntegrationBadResponse, match='out of order'):
        list(iter_fund_batches(path))


def test_a_registry_member_missing_a_column_is_a_bad_response(tmp_path):
    path = tmp_path / 'registro_fundo_classe.zip'
    path.write_bytes(
        zipped({
            'registro_fundo.csv': b'ID_Registro_Fundo;CNPJ_Fundo\n1;55139905000139\n',
            'registro_classe.csv': b'',
            'registro_subclasse.csv': b'',
        })
    )

    with pytest.raises(IntegrationBadResponse, match='Tipo_Fundo'):
        list(iter_fund_batches(path))


def test_every_daily_layout_is_read_and_only_the_requested_cnpjs_are_kept(tmp_path):
    path = tmp_path / 'inf_diario_fi_2020.zip'
    path.write_bytes(
        zipped({
            # 2000-2004 archives: no TP_FUNDO at all in some years, one CSV a year.
            'inf_diario_fi_2003.csv': csv_bytes(
                'CNPJ_FUNDO;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;CAPTC_DIA;RESG_DIA;NR_COTST',
                '00.017.024/0001-53;2003-01-02;1;10.5;1;0;0;1',
            ),
            'inf_diario_fi_202311.csv': csv_bytes(
                'TP_FUNDO;CNPJ_FUNDO;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;CAPTC_DIA;RESG_DIA;NR_COTST',
                'FI;00.017.024/0001-53;2023-11-30;1;20.25;1;0;0;1',
                'FI;11.111.111/0001-11;2023-11-30;1;99;1;0;0;1',
            ),
            'inf_diario_fi_202609.csv': csv_bytes(
                DAILY_HEADER,
                'CLASSES - FIF;00.017.024/0001-53;;2026-09-01;1;44.6367234;1;0;0;1',
                'CLASSES - FIF;00.017.024/0001-53;RBMFN1747320951;2026-09-01;1;73.28;1;0;0;1',
            ),
        })
    )

    scan = scan_share_value_filings(path, ShareValueDataset.DAILY, {'00017024000153'})

    assert scan.rows_read == 5
    assert [
        (filing.date, filing.subclass_code, filing.share_value)
        for filing in scan.filings['00017024000153']
    ] == [
        (date(2003, 1, 2), None, Decimal('10.5')),
        (date(2023, 11, 30), None, Decimal('20.25')),
        (date(2026, 9, 1), None, Decimal('44.6367234')),
        (date(2026, 9, 1), 'RBMFN1747320951', Decimal('73.28')),
    ]


def test_both_fidc_layouts_are_read_from_the_share_value_table_only(tmp_path):
    path = tmp_path / 'inf_mensal_fidc_2023.zip'
    path.write_bytes(
        zipped({
            'inf_mensal_fidc_tab_X_2_202301.csv': csv_bytes(
                'CNPJ_FUNDO;DENOM_SOCIAL;DT_COMPTC;TAB_X_CLASSE_SERIE;TAB_X_QT_COTA;TAB_X_VL_COTA',
                '55.139.905/0001-39;PLGN;2023-01-31;Série 1;10.00000000;1.01000000',
            ),
            'inf_mensal_fidc_tab_X_2_202312.csv': csv_bytes(
                FIDC_HEADER,
                'Classe;55.139.905/0001-39;PLGN;2023-12-31;Subclasse Senior Série 1;10;1.05',
            ),
            'inf_mensal_fidc_tab_IX_202312.csv': csv_bytes('CNPJ_FUNDO_CLASSE;X', '1;2'),
        })
    )

    scan = scan_share_value_filings(path, ShareValueDataset.FIDC_MONTHLY, {'55139905000139'})

    assert [(f.date, f.label, f.shares, f.share_value) for f in scan.filings['55139905000139']] == [
        (date(2023, 1, 31), 'Série 1', Decimal('10.00000000'), Decimal('1.01000000')),
        (date(2023, 12, 31), 'Subclasse Senior Série 1', Decimal('10'), Decimal('1.05')),
    ]


def test_a_share_value_member_without_the_value_column_is_a_bad_response(tmp_path):
    path = tmp_path / 'inf_mensal_fidc_202607.zip'
    path.write_bytes(
        zipped({
            'inf_mensal_fidc_tab_X_2_202607.csv': csv_bytes(
                'CNPJ_FUNDO_CLASSE;DT_COMPTC;TAB_X_CLASSE_SERIE;TAB_X_QT_COTA', '1;2026-07-31;A;1'
            )
        })
    )

    with pytest.raises(IntegrationBadResponse, match='TAB_X_VL_COTA'):
        scan_share_value_filings(path, ShareValueDataset.FIDC_MONTHLY, {'1'})


def test_an_empty_malformed_member_is_not_a_valid_snapshot_that_can_remove_quotes(tmp_path):
    path = tmp_path / 'inf_diario_fi_202609.zip'
    path.write_bytes(zipped({'inf_diario_fi_202609.csv': csv_bytes('CNPJ_FUNDO;DT_COMPTC')}))
    with pytest.raises(IntegrationBadResponse, match='VL_QUOTA'):
        scan_share_value_filings(path, ShareValueDataset.DAILY, {'1'})
