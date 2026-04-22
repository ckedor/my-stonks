import json
from datetime import datetime

import pandas as pd
from app.infra.http import AsyncHttpClient
from bs4 import BeautifulSoup


class AnbimaClient:
    def __init__(self):
        self.http = AsyncHttpClient(
            provider='anbima',
            base_url='https://data.anbima.com.br',
            timeout=30.0,
        )

    async def get_fund_history_df(self, anbima_class_code):
        html = await self.http.request('GET', f'/fundos/{anbima_class_code}/periodicos', parse='text')
        soup = BeautifulSoup(html, 'html.parser')

        scripts = soup.find_all('script')

        parsed_data = []
        for script in scripts:
            if script.string and 'valor_cota' in script.string:
                script_content = script.string
                cleaned_script = script_content.replace('\\"', '"').replace('\\', '')
                start_idx = cleaned_script.find('"content":[')

                start_idx += len('"content":')
                end_idx = cleaned_script.find(']', start_idx) + 1
                json_data = cleaned_script[start_idx:end_idx]
                parsed_data = json.loads(json_data)
                break

        processed_data = []
        for entry in parsed_data:
            date = datetime.strptime(entry['data_competencia'], '%d/%m/%Y').date()
            unit_price = float(entry['valor_cota'].split(' ')[1].replace(',', '.'))
            processed_data.append({'date': date, 'price': unit_price})

        df = pd.DataFrame(processed_data)
        df = df.set_index('date').asfreq('D').sort_index()
        df = df.reindex(pd.date_range(df.index.min(), datetime.today(), freq='D'))
        df['price'] = df['price'].ffill()
        df = df.reset_index(names='date')
        return df

    async def aclose(self):
        await self.http.aclose()
