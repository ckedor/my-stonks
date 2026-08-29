# app/infra/integrations/status_invest_client.py
"""O que ainda vem do Status Invest: o catálogo de FIIs.

Os proventos saíram daqui para `/v2/fii/dividends` do Brapi, que publica o
rótulo do evento -- e sem ele uma amortização de capital entrava na carteira
como rendimento.
"""

import json
from enum import IntEnum

import pandas as pd

from app.infra.http import AsyncHttpClient


class Category(IntEnum):
    FII = 2


class StatusInvestClient:
    def __init__(self):
        self.http = AsyncHttpClient(
            provider='status_invest',
            base_url='https://statusinvest.com.br',
            timeout=30.0,
            headers={'User-Agent': 'Chrome/112.0.0.0'},
        )

    async def get_fiis_df(self):
        search = {
            'Segment': '',
            'Gestao': '',
            'my_range': '0;20',
            'dy': {'Item1': None, 'Item2': None},
            'p_vp': {'Item1': None, 'Item2': None},
            'percentualcaixa': {'Item1': None, 'Item2': None},
            'numerocotistas': {'Item1': None, 'Item2': None},
            'dividend_cagr': {'Item1': None, 'Item2': None},
            'cota_cagr': {'Item1': None, 'Item2': None},
            'liquidezmediadiaria': {'Item1': None, 'Item2': None},
            'patrimonio': {'Item1': None, 'Item2': None},
            'valorpatrimonialcota': {'Item1': None, 'Item2': None},
            'numerocotas': {'Item1': None, 'Item2': None},
            'lastdividend': {'Item1': None, 'Item2': None},
        }

        all_data = []
        page = 0
        take = 99
        category = Category.FII

        while True:
            params = {
                'search': json.dumps(search),
                'orderColumn': '',
                'isAsc': '',
                'page': page,
                'take': take,
                'CategoryType': category,
            }
            data = await self.http.request(
                'GET', '/category/advancedsearchresultpaginated', params=params
            )
            if len(data['list']) == 0:
                break
            all_data.extend(data['list'])
            page += 1

        return pd.DataFrame(all_data)

    async def aclose(self):
        await self.http.aclose()
