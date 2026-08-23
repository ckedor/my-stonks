"""Official B3 index statistics used when quote providers omit index history."""

import base64
import json

from app.infra.http import AsyncHttpClient


class B3IndexClient:
    """Small client for the daily-evolution dataset published by B3."""

    def __init__(self) -> None:
        self.http = AsyncHttpClient(
            provider='b3-index-statistics',
            base_url='https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall',
            timeout=20.0,
        )

    async def get_daily_evolution(self, *, index: str, year: int) -> dict:
        payload = {
            'index': index.upper(),
            'language': 'pt-br',
            'year': str(year),
        }
        encoded = base64.b64encode(json.dumps(payload, separators=(',', ':')).encode()).decode()
        return await self.http.request('GET', f'/GetPortfolioDay/{encoded}')

    async def aclose(self) -> None:
        await self.http.aclose()
