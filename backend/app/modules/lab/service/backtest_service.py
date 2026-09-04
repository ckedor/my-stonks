"""A simulação de uma carteira teórica, sob demanda.

Não persiste nada. O que ela lê — cotações, séries de mercado, câmbio — já está
no banco; o que ela produz é derivado disso e barato de refazer, então guardar
a curva só criaria uma segunda verdade para invalidar toda vez que uma cotação
nova chegasse.
"""

from __future__ import annotations

import pandas as pd

from app.config.logger import logger
from app.core.exceptions import NotFoundError, ValidationError
from app.lib.finance.analysis import calculate_returns_analysis
from app.lib.utils.df import rows_to_df
from app.modules.lab.domain.backtest import (
    align_prices,
    resolve_window_start,
    run_backtest,
    series_from_quotes,
)
from app.modules.lab.domain.commands import (
    CompareBacktestsCommand,
    RunBacktestCommand,
    TheoreticalPositionCommand,
)
from app.modules.lab.domain.pricing import synthetic_label, synthetic_price_series
from app.modules.lab.domain.result import BacktestResult, BacktestWindow

#: Quanto do câmbio o conversor precisa saber. `CURRENCY_MAP` mora no domínio
#: de market_data e é de onde os ids saem.
from app.modules.market_data.domain.constants import CURRENCY_MAP, SERIES
from app.modules.market_data.domain.quote import adjusted_price, convert_quotes_to_currency
from app.modules.market_data.service.market_data_service import MarketDataReadService
from app.modules.market_data.service.quote_service import (
    OnDemandQuoteReadService,
    PersistedQuoteReadService,
)
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService


class BacktestService:
    """Roda carteiras teóricas sobre preços passados."""

    def __init__(
        self,
        *,
        persisted_quotes: PersistedQuoteReadService,
        on_demand_quotes: OnDemandQuoteReadService,
        market_data: MarketDataReadService,
        usd_brl: UsdBrlReadService,
    ) -> None:
        self.persisted_quotes = persisted_quotes
        self.on_demand_quotes = on_demand_quotes
        self.market_data = market_data
        self.usd_brl = usd_brl

    async def run(self, command: RunBacktestCommand) -> BacktestResult:
        results = await self.compare(CompareBacktestsCommand(runs=[command]))
        return results[0]

    async def compare(self, command: CompareBacktestsCommand) -> list[BacktestResult]:
        """Uma ou várias simulações, lidas na mesma janela.

        As séries de preço são buscadas **uma vez** para a união das linhas de
        todas as corridas: variar a frequência de rebalanceamento não muda
        preço nenhum, e refazer a busca por corrida transformaria um painel de
        variações em N idas ao banco e ao provedor.
        """
        if not command.runs:
            raise ValidationError('Nenhuma simulação foi pedida.')

        currency = command.runs[0].currency
        window_start = _earliest_requested_start(command.runs)
        end_date = _latest_end(command.runs)

        positions = [item for run in command.runs for item in run.positions]
        prices_by_key, labels = await self._price_lines(
            positions,
            currency=currency,
            start_date=window_start,
        )

        results: list[BacktestResult] = []
        for run in command.runs:
            keys = [_position_key(item) for item in run.positions]
            weights = {key: item.weight for key, item in zip(keys, run.positions, strict=True)}
            frame, limited_by = align_prices(
                {key: prices_by_key[key] for key in keys},
                start_date=_run_start(run),
                end_date=end_date,
            )
            result, returns = run_backtest(
                prices=frame,
                weights=weights,
                labels=labels,
                initial_amount=run.initial_amount,
                contribution_amount=run.contribution_amount,
                contribution_frequency=run.contribution_frequency,
                rebalance_frequency=run.rebalance_frequency,
                requested_start_date=_run_start(run),
            )
            analysis = await self._analysis(
                returns,
                currency=run.currency,
                benchmark_ids=run.benchmark_ids,
            )
            results.append(
                _with(
                    result,
                    label=run.label,
                    limited_by=labels.get(limited_by) if limited_by else None,
                    analysis=analysis,
                )
            )
        return results

    async def _analysis(
        self,
        returns: pd.Series,
        *,
        currency: str,
        benchmark_ids: list[int],
    ) -> dict | None:
        """A mesma leitura que a carteira real recebe.

        `calculate_returns_analysis` exige a chave `CDI` — é contra ela que o
        Sharpe é medido —, então o CDI entra sempre, e os benchmarks escolhidos
        se somam a ele. Um Sharpe calculado sobre outra taxa livre de risco não
        é comparável com o da carteira real, que é o ponto de a tela ser a
        mesma.
        """
        if returns.empty:
            return None

        start_date = returns.index.min()
        benchmarks: dict[str, pd.Series] = {
            'CDI': await self.market_data.get_series_history_values(
                start_date, SERIES.CDI, currency
            )
        }
        for series_id in dict.fromkeys(benchmark_ids):
            if series_id == SERIES.CDI:
                continue
            name = await self._series_name(series_id)
            values = await self.market_data.get_series_history_values(
                start_date, series_id, currency
            )
            if not values.empty:
                benchmarks[name] = values

        return calculate_returns_analysis(returns, benchmarks)

    async def _price_lines(
        self,
        positions: list[TheoreticalPositionCommand],
        *,
        currency: str,
        start_date: pd.Timestamp | None,
    ) -> tuple[dict[str, pd.Series], dict[str, str]]:
        """A série de preço de cada linha distinta, e como cada uma se chama."""
        unique: dict[str, TheoreticalPositionCommand] = {}
        for item in positions:
            unique.setdefault(_position_key(item), item)

        asset_ids = [item.asset_id for item in unique.values() if item.asset_id is not None]
        quotes_by_asset, labels_by_asset = await self._asset_prices(
            asset_ids,
            currency=currency,
            start_date=start_date,
        )

        prices: dict[str, pd.Series] = {}
        labels: dict[str, str] = {}
        for key, item in unique.items():
            if item.asset_id is not None:
                series = quotes_by_asset.get(item.asset_id)
                if series is None or series.empty:
                    raise NotFoundError(
                        'Não há cotação para um dos ativos da carteira teórica.',
                        context={'asset_id': item.asset_id},
                    )
                prices[key] = series
                labels[key] = item.label or labels_by_asset.get(item.asset_id, str(item.asset_id))
                continue

            series, label = await self._series_prices(item, currency=currency)
            prices[key] = series
            labels[key] = item.label or label
        return prices, labels

    async def _asset_prices(
        self,
        asset_ids: list[int],
        *,
        currency: str,
        start_date: pd.Timestamp | None,
    ) -> tuple[dict[int, pd.Series], dict[int, str]]:
        """O preço de cada ativo, do banco quando existe e do provedor quando não.

        A cesta inteira sai numa consulta só. Os ativos que voltarem sem
        cotação nenhuma — os que nunca foram ingeridos, tipicamente um ativo que
        alguém acabou de escolher no catálogo — caem no provedor, um a um: o
        mantenedor pediu que a simulação não dependesse de ingestão prévia.

        O preço é o **fechamento ajustado**, e não o negociado. O ajustado já
        traz dentro dele desdobramento e provento, que é o que faz um FII que
        distribui quase tudo parar de parecer plano por uma década — e é o que
        dispensa reconstruir dividendo por cota, coisa para a qual não existe
        tabela.
        """
        if not asset_ids:
            return {}, {}

        entries = await self.persisted_quotes.get_quotes(
            asset_ids=list(dict.fromkeys(asset_ids)),
            start_date=start_date.date() if start_date is not None else None,
        )

        rate_payload = await self.usd_brl.get_full_history()
        target_currency_id = CURRENCY_MAP.get(currency.upper())
        if target_currency_id is None:
            raise ValidationError(f'Moeda não suportada: {currency}')

        prices: dict[int, pd.Series] = {}
        labels: dict[int, str] = {}
        for entry in entries:
            labels[entry['asset_id']] = entry['ticker'] or str(entry['asset_id'])
            quotes = entry['quotes']
            default_currency_id = None

            if not quotes:
                fetched = await self.on_demand_quotes.get_quotes(
                    ticker=entry['ticker'],
                    asset_type_id=entry['asset_type_id'],
                    start_date=start_date.date() if start_date is not None else None,
                )
                quotes = fetched['quotes']
                default_currency_id = CURRENCY_MAP.get(fetched['currency'])
                logger.info(
                    'Laboratório: %s veio do provedor, sem histórico persistido',
                    entry['ticker'],
                )

            quotes = convert_quotes_to_currency(
                quotes,
                rate_payload,
                target_currency_id=target_currency_id,
                default_currency_id=default_currency_id,
            )
            prices[entry['asset_id']] = series_from_quotes(quotes, adjusted_price)
        return prices, labels

    async def _series_prices(
        self,
        item: TheoreticalPositionCommand,
        *,
        currency: str,
    ) -> tuple[pd.Series, str]:
        """O preço de uma linha que não tem ativo atrás.

        Sem tipo de rentabilidade a série entra como nível, e é o mesmo nível
        que a análise usa quando aquela série é benchmark — um IBOVESPA na
        carteira e um IBOVESPA na comparação não podem ser dois números.
        Com tipo e taxa, a série entra como taxa diária e a linha vira renda
        fixa sintética.
        """
        name = await self._series_name(item.series_id) if item.series_id else None

        if item.fixed_income_type_id is None:
            values = await self.market_data.get_series_history_values(
                None, item.series_id, currency
            )
            if values.empty:
                raise NotFoundError(
                    'Não há histórico para uma das séries da carteira teórica.',
                    context={'series_id': item.series_id},
                )
            return values.astype(float), name or str(item.series_id)

        if item.series_id is not None:
            rows = await self.market_data.get_series_history(item.series_id)
            history = rows_to_df(rows, datetime_cols=['date'])
        else:
            # Um prefixado não acompanha índice, mas precisa de um calendário
            # para acumular sobre. O do CDI é o calendário de dia útil que o
            # resto da renda fixa já usa, e zerar a taxa deixa só o juro fixo.
            rows = await self.market_data.get_series_history(SERIES.CDI)
            history = rows_to_df(rows, datetime_cols=['date'])
            if not history.empty:
                history['close'] = 0.0

        if history.empty:
            raise NotFoundError(
                'Não há histórico para uma das séries da carteira teórica.',
                context={'series_id': item.series_id},
            )

        prices = synthetic_price_series(
            index_history=history,
            fixed_income_type_id=item.fixed_income_type_id,
            rate=item.rate,
        )
        label = synthetic_label(
            fixed_income_type_id=item.fixed_income_type_id,
            rate=item.rate,
            series_name=name,
        )
        return prices, label

    async def _series_name(self, series_id: int) -> str:
        series = await self.market_data.list_market_data_series()
        for item in series:
            if item.id == series_id:
                return item.short_name or item.name
        return str(series_id)

    async def aclose(self) -> None:
        await self.on_demand_quotes.aclose()


def _position_key(item: TheoreticalPositionCommand) -> str:
    """A identidade de uma linha como fonte de preço.

    Duas corridas que usam o mesmo ativo ou a mesma renda fixa sintética
    compartilham a série, e é essa chave que as reconhece como a mesma coisa.
    O peso não entra: mudar o peso não muda o preço.
    """
    if item.asset_id is not None:
        return f'asset:{item.asset_id}'
    return f'series:{item.series_id}:{item.fixed_income_type_id}:{item.rate}'


def _run_start(run: RunBacktestCommand) -> pd.Timestamp | None:
    return resolve_window_start(
        years=run.years,
        start_date=pd.Timestamp(run.start_date) if run.start_date else None,
        today=pd.Timestamp.today().normalize(),
    )


def _earliest_requested_start(runs: list[RunBacktestCommand]) -> pd.Timestamp | None:
    """A data mais antiga que alguma corrida pediu.

    A busca é uma só para todas, então ela tem de cobrir a mais ambiciosa. Uma
    corrida que queria menos recorta depois, em memória.
    """
    starts = [_run_start(run) for run in runs]
    known = [value for value in starts if value is not None]
    if len(known) < len(starts):
        return None
    return min(known) if known else None


def _latest_end(runs: list[RunBacktestCommand]) -> pd.Timestamp | None:
    ends = [pd.Timestamp(run.end_date) for run in runs if run.end_date]
    return max(ends) if ends else None


def _with(
    result: BacktestResult,
    *,
    label: str | None,
    limited_by: str | None,
    analysis: dict | None,
) -> BacktestResult:
    """O resultado com o que só o serviço sabe. Ele é frozen, então é cópia."""
    window = BacktestWindow(
        start_date=result.window.start_date,
        end_date=result.window.end_date,
        limited_by=limited_by,
        requested_start_date=result.window.requested_start_date,
    )
    return BacktestResult(
        label=label,
        window=window,
        series=result.series,
        lines=result.lines,
        final_value=result.final_value,
        invested=result.invested,
        profit=result.profit,
        contributions=result.contributions,
        rebalances=result.rebalances,
        analysis=analysis,
    )
