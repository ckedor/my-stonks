import { useQuery } from '@tanstack/react-query'
import { fetchAssetReturns } from '@/api/portfolio'
import { useCurrency } from '@/hooks/useCurrency'
import { normalizeReturns } from '@/lib/utils/returns'
import dayjs from 'dayjs'
import { useCallback, useMemo } from 'react'

export interface AssetReturnWindow {
  /** Retorno acumulado em cada dia da janela, em pontos percentuais, partindo
   *  de zero no primeiro dia. */
  values: number[] | null
  /** O que a janela rendeu, e quantos dias ela de fato cobre. */
  period: { totalReturn: number; days: number } | null
}

/** O retorno da posição em um ativo nos últimos meses, rebaseado ao início da
 *  janela.
 *
 *  Duas propriedades vêm do rebase e as duas importam:
 *
 *  - a curva parte de zero, então serve para desenhar sozinha, sem eixo;
 *  - o último valor dela *é* o retorno do período — inclusive quando a posição
 *    é mais nova que a janela, caso em que ela cobre a idade da posição. É por
 *    isso que o retorno sai daqui e não de `twelve_months_return`, que o
 *    backend zera para posições com menos de doze meses.
 *
 *  Uma requisição por ativo: a rota de retornos é por ativo, e embora o serviço
 *  do backend aceite uma lista, nenhuma rota expõe isso. Cada resposta fica em
 *  cache por ativo e moeda. */
export function useAssetReturnWindow(
  portfolioId: number | undefined,
  assetId: number,
  ticker: string,
  months = 12,
): AssetReturnWindow {
  const { currency } = useCurrency()
  const startDate = dayjs().subtract(months, 'month').format('YYYY-MM-DD')

  const { data } = useQuery<{ date: string; value: number }[]>({
    queryKey: [portfolioId ? `asset-returns-${months}m:${portfolioId}:${assetId}:${currency}` : null],
    queryFn: useCallback(async () => {
      // Sem `.catch` engolindo a falha: um erro aqui viraria série vazia, e a
      // série vazia viraria um espaço em branco no card — foi assim que um 500
      // do backend passou despercebido. Que a requisição falhe alto.
      const byTicker = await fetchAssetReturns(portfolioId!, assetId, currency, startDate)
      const series = byTicker[ticker] ?? Object.values(byTicker)[0] ?? []
      return normalizeReturns(
        series,
        series.map((point) => point.date),
      )
    }, [portfolioId, assetId, ticker, currency, startDate]),
    enabled: (portfolioId ? `asset-returns-${months}m:${portfolioId}:${assetId}:${currency}` : null) != null && !!portfolioId,
  })

  return useMemo(() => {
    if (!data || data.length < 2) return { values: null, period: null }
    return {
      values: data.map((point) => point.value * 100),
      period: {
        totalReturn: data.at(-1)!.value * 100,
        days: dayjs(data.at(-1)!.date).diff(dayjs(data[0].date), 'day'),
      },
    }
  }, [data])
}
