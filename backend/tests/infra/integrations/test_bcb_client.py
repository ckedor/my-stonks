from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.infra.integrations.bcb_client import BCBClient


@pytest.mark.asyncio
async def test_ipca_incremental_request_uses_six_month_lookback():
    client = BCBClient.__new__(BCBClient)
    client.index_endpoints = {
        'IPCA': 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json'
    }
    client.http = SimpleNamespace(
        request=AsyncMock(return_value=[{'data': '01/06/2026', 'valor': '0,16'}])
    )

    result = await client.get_market_index_history_df(
        'IPCA',
        init_date=pd.Timestamp('2026-08-01'),
    )

    endpoint = client.http.request.await_args.args[1]
    assert endpoint.endswith('&dataInicial=01/02/2026')
    assert result.to_dict(orient='records') == [{'date': pd.Timestamp('2026-06-01'), 'value': 0.16}]


@pytest.mark.asyncio
async def test_market_index_request_returns_typed_empty_frame_when_no_value_is_published():
    client = BCBClient.__new__(BCBClient)
    client.index_endpoints = {
        'IPCA': 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json'
    }
    client.http = SimpleNamespace(request=AsyncMock(return_value=[]))

    result = await client.get_market_index_history_df(
        'IPCA',
        init_date=pd.Timestamp('2026-08-01'),
    )

    assert result.empty
    assert result.columns.tolist() == ['date', 'value']
