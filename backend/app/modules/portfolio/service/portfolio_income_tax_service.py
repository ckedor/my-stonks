# app/modules/portfolio/service/portfolio_income_tax_service.py
"""
Imposto de renda: a apuração do contribuinte e o informe de bens e direitos.

A apuração é do usuário — todas as carteiras dele —, e o cálculo mora em
`domain/income_tax/`. Aqui só se leem os fatos pelo unit of work, se traduzem
para o motor e se registram os pagamentos de DARF.

O informe de bens e direitos ainda é por carteira e ainda lê a posição a preço
de mercado; migrá-lo para a apuração, a custo, é a etapa seguinte do plano.
"""

from datetime import date
from decimal import Decimal

import pandas as pd

from app.core.exceptions import NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.lib.utils.df import rows_to_df
from app.lib.utils.fastapi import df_response
from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY
from app.modules.market_data.domain.market_scope import is_brazilian_market
from app.modules.portfolio.domain.income_tax.darf import DarfPayment
from app.modules.portfolio.domain.income_tax.report import IncomeTaxReport, assess
from app.modules.portfolio.domain.income_tax.trades import (
    AssetFacts,
    CorporateEvent,
    TaxTrade,
    classify,
)

#: Colunas do informe de bens e direitos, na ordem em que a Receita as lê.
#: Declaradas aqui porque a resposta vazia precisa ter a mesma forma da cheia:
#: o cliente não deve descobrir que a carteira está vazia pelo formato.
_ASSETS_AND_RIGHTS_COLUMNS: list[str] = [
    'grupo',
    'codigo',
    'discriminacao',
    'position_previous_year',
    'position_fiscal_year',
    'exempt_dividends',
    'codigo_negociacao',
    'negociado_em_bolsa',
    'locale',
    'cnpj',
    'broker_name',
]

#: Os tipos cuja praça de negociação decide Brasil ou exterior. Para todo o
#: resto a pergunta não se aplica: renda fixa e Tesouro não têm bolsa.
#: Um CNPJ completo, para decidir se o valor pode ser pontuado.
_CNPJ_DIGITS = 14

_EXCHANGE_TRADED_TYPES: frozenset[ASSET_TYPE] = frozenset({
    ASSET_TYPE.STOCK,
    ASSET_TYPE.ETF,
    ASSET_TYPE.BDR,
    ASSET_TYPE.REIT,
    ASSET_TYPE.FII,
})

_EXEMPT_DIVIDEND_ASSET_TYPES: list[ASSET_TYPE] = [
    ASSET_TYPE.FII,
    ASSET_TYPE.CRI,
    ASSET_TYPE.CRA,
    ASSET_TYPE.LCA,
]


class PortfolioIncomeTaxService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def get_assessment(
        self, user_id: int, fiscal_year: int, today: date | None = None
    ) -> IncomeTaxReport:
        """A apuração do ano-calendário, sobre todas as carteiras do usuário."""
        async with self.uow as uow:
            portfolios = await uow.portfolios.get_user_portfolios(user_id)
            rows = await uow.portfolios.get_income_tax_trades([
                portfolio.id for portfolio in portfolios
            ])
            events = await uow.portfolios.get_events_for_assets(
                sorted({row['asset_id'] for row in rows})
            )
            payments = await uow.portfolios.get_darf_payments(user_id)

        return assess(
            fiscal_year=fiscal_year,
            trades=[_tax_trade(row) for row in rows],
            events=[
                CorporateEvent(
                    asset_id=event.asset_id,
                    day=event.date,
                    type=event.type,
                    factor=_decimal(event.factor),
                )
                for event in events
            ],
            payments=payments,
            today=today or date.today(),
        )

    async def list_darf_payments(self, user_id: int) -> list[DarfPayment]:
        async with self.uow as uow:
            return await uow.portfolios.get_darf_payments(user_id)

    async def register_darf_payment(  # noqa: PLR0913
        self,
        user_id: int,
        *,
        revenue_code: str,
        period: date,
        paid_on: date,
        principal: Decimal,
        fine: Decimal = Decimal(0),
        interest: Decimal = Decimal(0),
    ) -> DarfPayment:
        payment = DarfPayment(
            user_id=user_id,
            revenue_code=revenue_code,
            period=period.replace(day=1),
            paid_on=paid_on,
            principal=principal,
            fine=fine,
            interest=interest,
        )
        async with self.uow as uow:
            await uow.portfolios.create(DarfPayment, [payment])
            await uow.commit()
        return payment

    async def delete_darf_payment(self, user_id: int, payment_id: int) -> None:
        async with self.uow as uow:
            payment = await uow.portfolios.get(DarfPayment, id=payment_id)
            if payment is None or payment.user_id != user_id:
                raise NotFoundError(
                    'Pagamento de DARF não encontrado', context={'payment_id': payment_id}
                )
            await uow.portfolios.delete(DarfPayment, id=payment_id)
            await uow.commit()

    async def get_assets_and_rights(self, portfolio_id: int, fiscal_year: int) -> dict:
        last_day_fiscal_year = pd.to_datetime(f'{fiscal_year}-12-31')
        last_day_previous_year = pd.to_datetime(f'{fiscal_year - 1}-12-31')

        async with self.uow as uow:
            position_fy_rows = await uow.portfolios.get_position_on_date_by_broker(
                portfolio_id, last_day_fiscal_year
            )
            position_prev_rows = await uow.portfolios.get_position_on_date_by_broker(
                portfolio_id, last_day_previous_year
            )

        if not position_fy_rows and not position_prev_rows:
            # Uma carteira sem posição nos dois anos não tem o que declarar. Sem
            # esta saída o merge abaixo procura asset_id num DataFrame que não
            # tem coluna nenhuma, e a rota responde 500 em vez de um informe vazio.
            return df_response(pd.DataFrame(columns=_ASSETS_AND_RIGHTS_COLUMNS))

        position_dec_fy = rows_to_df(
            position_fy_rows,
            datetime_cols=['date'],
        )
        position_dec_prev = rows_to_df(
            position_prev_rows,
            datetime_cols=['date'],
        )

        df = pd.merge(
            position_dec_fy,
            position_dec_prev,
            on=['asset_id', 'ticker', 'broker_id'],
            how='outer',
            suffixes=('_fiscal_year', '_previous_year'),
        )

        df['type_id'] = df['type_id_fiscal_year'].combine_first(df['type_id_previous_year'])
        df['class'] = df['class_fiscal_year'].combine_first(df['class_previous_year'])
        df['category'] = df['category_fiscal_year'].combine_first(df['category_previous_year'])
        df['currency_id'] = df['currency_id_fiscal_year'].combine_first(
            df['currency_id_previous_year']
        )
        df['name'] = df['name_fiscal_year'].combine_first(df['name_previous_year'])
        for column in ('issuer_cnpj', 'fund_cnpj', 'exchange_code'):
            df[column] = df[f'{column}_fiscal_year'].combine_first(df[f'{column}_previous_year'])
        df['broker_name'] = df['broker_name_fiscal_year'].combine_first(
            df['broker_name_previous_year']
        )
        df['broker_cnpj'] = df['broker_cnpj_fiscal_year'].combine_first(
            df['broker_cnpj_previous_year']
        )

        df['price_fiscal_year'] = df['price_fiscal_year'].fillna(0.0)
        df['price_previous_year'] = df['price_previous_year'].fillna(0.0)
        df['quantity_fiscal_year'] = df['quantity_fiscal_year'].fillna(0.0)
        df['quantity_previous_year'] = df['quantity_previous_year'].fillna(0.0)

        df['position_fiscal_year'] = df['quantity_fiscal_year'] * df['price_fiscal_year']
        df['position_previous_year'] = df['quantity_previous_year'] * df['price_previous_year']

        df['position_previous_year'] = df['position_previous_year'].round(2)
        df['position_fiscal_year'] = df['position_fiscal_year'].round(2)

        async with self.uow as uow:
            exempt_dividends_rows = await uow.portfolios.get_exempt_dividends_summary(
                portfolio_id=portfolio_id,
                start_date=pd.to_datetime(f'{fiscal_year}-01-01').date(),
                end_date=pd.to_datetime(f'{fiscal_year}-12-31').date(),
                asset_type_ids=[int(asset_type) for asset_type in _EXEMPT_DIVIDEND_ASSET_TYPES],
                currency='BRL',
            )
        exempt_dividends_by_asset = {
            row['asset_id']: float(row['total_dividends'] or 0) for row in exempt_dividends_rows
        }
        df['exempt_dividends'] = df['asset_id'].map(exempt_dividends_by_asset).fillna(0.0).round(2)

        # Exclui previdência (PGBL)
        df = df[df['type_id'] != ASSET_TYPE.PREV]

        df['grupo'] = df.apply(self._map_group, axis=1)
        df['codigo'] = df.apply(self._map_code, axis=1)
        df['discriminacao'] = df.apply(self._map_description, axis=1)
        df['codigo_negociacao'] = df['ticker']
        df['negociado_em_bolsa'] = df['type_id'].apply(self._is_traded_on_exchange)
        df['locale'] = df.apply(self._map_locale, axis=1)
        df['cnpj'] = df.apply(self._map_cnpj, axis=1)

        final_df = df[_ASSETS_AND_RIGHTS_COLUMNS]

        return df_response(final_df)

    @staticmethod
    def _is_traded_on_exchange(asset_type):
        return asset_type in {
            ASSET_TYPE.ETF,
            ASSET_TYPE.FII,
            ASSET_TYPE.STOCK,
            ASSET_TYPE.BDR,
            ASSET_TYPE.FI,
        }

    @staticmethod
    def _is_brazilian(row) -> bool:
        """Onde o ativo é negociado, pela regra que o domínio já tem.

        Antes isto saía da moeda da **corretora**, o que classificava uma ação
        brasileira comprada por corretora de base dólar como ação no exterior.
        A praça é do ativo, não de quem custodia, e `is_brazilian_market` é a
        mesma função que decide o segmento de uma posição — uma pergunta, um
        dono.

        Só vale para o que é negociado em bolsa. Um CDB, um CRA ou um título
        público não têm praça, e o "ticker" deles é descritivo — `CDB C6
        12/02/2027` não tem forma de código da B3 e cairia como estrangeiro se
        passasse pela regra. Eles são brasileiros por construção, que é como o
        cadastro os registra.
        """
        if row['type_id'] not in _EXCHANGE_TRADED_TYPES:
            return True
        # O merge dos dois anos deixa NaN onde a posição só existe num deles, e
        # NaN não é None: sem isto a comparação com o código da bolsa dá falso
        # e o papel vira estrangeiro.
        exchange_code = row.get('exchange_code')
        if exchange_code is None or pd.isna(exchange_code):
            exchange_code = None
        return is_brazilian_market(exchange_code, row.get('ticker'))

    @staticmethod
    def _format_cnpj(value) -> str | None:
        """O CNPJ pontuado, venha ele de onde vier.

        A corretora guarda o documento já pontuado e o cadastro do regulador
        guarda só os dígitos. Sem normalizar, o mesmo informe sai com os dois
        formatos misturados.
        """
        if value is None or pd.isna(value):
            return None
        digits = ''.join(character for character in str(value) if character.isdigit())
        if len(digits) != _CNPJ_DIGITS:
            return str(value) or None
        return f'{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}'

    @classmethod
    def _map_cnpj(cls, row):
        """O CNPJ que a ficha pede, que é o do emissor e não o da corretora.

        Um fundo é pessoa jurídica e responde por si: o CNPJ vem do cadastro
        do regulador ao qual o FII ou o ETF está ligado. Uma ação responde pela
        companhia que a emitiu. Todo o resto continua declarando a corretora,
        que é onde o papel está custodiado — para renda fixa e Tesouro é ela
        mesma que a ficha pede.
        """
        if row['type_id'] in (ASSET_TYPE.FII, ASSET_TYPE.ETF, ASSET_TYPE.FI, ASSET_TYPE.PREV):
            issuer = row.get('fund_cnpj')
        elif row['type_id'] in (ASSET_TYPE.STOCK, ASSET_TYPE.BDR):
            issuer = row.get('issuer_cnpj')
        else:
            issuer = None
        return cls._format_cnpj(issuer) or cls._format_cnpj(row['broker_cnpj'])

    @classmethod
    def _map_locale(cls, row):
        if row['type_id'] == ASSET_TYPE.CRIPTO:
            return '105'  # Cripto no Brasil
        return '105' if cls._is_brazilian(row) else '249'

    @classmethod
    def _map_group(cls, row):
        brazilian = cls._is_brazilian(row)
        if row['type_id'] == ASSET_TYPE.CRIPTO:
            return '08'
        elif row['type_id'] == ASSET_TYPE.STOCK and brazilian:
            return '03'  # Ações brasileiras
        elif row['type_id'] == ASSET_TYPE.STOCK and not brazilian:
            return '04'  # Ações no exterior
        elif row['type_id'] == ASSET_TYPE.ETF and not brazilian:
            return '04'  # ETF exterior
        elif row['type_id'] in [ASSET_TYPE.ETF, ASSET_TYPE.FII, ASSET_TYPE.FI]:
            return '07'
        elif row['type_id'] in [
            ASSET_TYPE.CDB,
            ASSET_TYPE.CRA,
            ASSET_TYPE.CRI,
            ASSET_TYPE.DEB,
            ASSET_TYPE.TREASURY,
            ASSET_TYPE.BDR,
        ]:
            return '04'
        else:
            return '99'

    @classmethod
    def _map_code(cls, row):  # noqa: PLR0912
        brazilian = cls._is_brazilian(row)
        if row['type_id'] == ASSET_TYPE.CRIPTO:
            if row['ticker'] == 'BTC':
                return '01'
            elif row['ticker'] in ['ETH', 'ADA', 'SOL', 'XRP']:
                return '02'
            elif row['ticker'] in ['USDT', 'USDC', 'DAI']:
                return '03'
            else:
                return '99'

        if row['type_id'] == ASSET_TYPE.STOCK and brazilian:
            return '01'
        if row['type_id'] == ASSET_TYPE.STOCK and not brazilian:
            return '99'
        if row['type_id'] == ASSET_TYPE.ETF and not brazilian:
            return '99'

        elif row['type_id'] in [ASSET_TYPE.CDB, ASSET_TYPE.DEB, ASSET_TYPE.TREASURY]:
            return '02'
        elif row['type_id'] in [ASSET_TYPE.CRA, ASSET_TYPE.CRI]:
            return '03'
        elif row['type_id'] == ASSET_TYPE.BDR:
            return '04'
        elif row['type_id'] == ASSET_TYPE.FII:
            return '03'
        elif row['type_id'] == ASSET_TYPE.ETF:
            return '09'
        elif row['type_id'] == ASSET_TYPE.FI:
            return '13'
        else:
            return '99'

    @staticmethod
    def _map_description(row):  # noqa: PLR0912
        broker = row.get('broker_name', '')
        if row['type_id'] == ASSET_TYPE.CRIPTO:
            return f'Criptoativo {row["name"]} ({row["ticker"]}), armazenado em {broker}.'
        if row['type_id'] == ASSET_TYPE.CDB:
            return f'CDB {row["name"]} ({row["ticker"]}), adquirido via {broker}.'
        if row['type_id'] == ASSET_TYPE.TREASURY:
            return f'Título público {row["name"]} ({row["ticker"]}), adquirido via Tesouro Direto ({broker}).'
        if row['type_id'] == ASSET_TYPE.CRA:
            return f'CRA {row["name"]} ({row["ticker"]}), isento de IR, adquirido via {broker}.'
        if row['type_id'] == ASSET_TYPE.CRI:
            return f'CRI {row["name"]} ({row["ticker"]}), isento de IR, adquirido via {broker}.'
        if row['type_id'] == ASSET_TYPE.DEB:
            return f'Debênture {row["name"]} ({row["ticker"]}), adquirida via {broker}.'
        if row['type_id'] == ASSET_TYPE.ETF and row['currency_id'] == CURRENCY.BRL:
            return f'ETF {row["name"]} ({row["ticker"]}) negociado na B3 via {broker}.'
        if row['type_id'] == ASSET_TYPE.ETF and row['currency_id'] == CURRENCY.USD:
            return f'ETF {row["name"]} ({row["ticker"]}) negociado no exterior via {broker}.'
        if row['type_id'] == ASSET_TYPE.STOCK and row['currency_id'] == CURRENCY.BRL:
            return (
                f'Ações da empresa {row["name"]} ({row["ticker"]}) negociadas na B3 via {broker}.'
            )
        if row['type_id'] == ASSET_TYPE.STOCK and row['currency_id'] == CURRENCY.USD:
            return f'Ações da empresa {row["name"]} ({row["ticker"]}) negociadas no exterior via {broker}.'
        if row['type_id'] == ASSET_TYPE.BDR:
            return f'BDR da empresa {row["name"]} ({row["ticker"]}), negociado na B3 via {broker}.'
        if row['type_id'] == ASSET_TYPE.FII:
            return (
                f'Fundo Imobiliário {row["name"]} ({row["ticker"]}) negociado na B3 via {broker}.'
            )
        if row['type_id'] == ASSET_TYPE.FI:
            return f'Fundo de investimento {row["name"]} ({row["ticker"]}) com tributação periódica, via {broker}.'
        else:
            return f'Ativo {row["name"]} ({row["ticker"]}) via {broker}.'


def _decimal(value) -> Decimal:
    """Float do banco para Decimal pelo texto, sem o ruído binário (0.1 vira 0.1)."""
    return Decimal(str(value))


def _tax_trade(row) -> TaxTrade:
    classification = classify(
        AssetFacts(
            asset_type_id=row['asset_type_id'],
            ticker=row['ticker'],
            exchange_code=row['exchange_code'],
            broker_currency_id=row['broker_currency_id'],
            etf_segment_id=row['etf_segment_id'],
            fund_kind=row['fund_kind'],
        )
    )
    day = row['date']
    return TaxTrade(
        transaction_id=row['transaction_id'],
        portfolio_id=row['portfolio_id'],
        asset_id=row['asset_id'],
        ticker=row['ticker'] or f'#{row["asset_id"]}',
        kind=classification.kind,
        note=classification.note,
        broker_id=row['broker_id'],
        day=day.date() if hasattr(day, 'date') else day,
        quantity=_decimal(row['quantity']),
        price=_decimal(row['price']),
        fees=None if row['fees'] is None else _decimal(row['fees']),
        withheld_income_tax=(
            None if row['withheld_income_tax'] is None else _decimal(row['withheld_income_tax'])
        ),
    )
