import TradesTable from '@/components/portfolio-trades/TradesTable'
import { AppCard, AppMetric, AppStack, AppText } from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import type { Trade } from '@/types'
import { useMemo } from 'react'

interface Props {
  /** As operações do recorte, já filtradas pelos ativos dele. */
  trades: Trade[]
  loading?: boolean
}

/** Passando disto a tabela rola por dentro, com o cabeçalho parado. */
const TABLE_MAX_HEIGHT = 560

/** As operações do recorte.
 *
 *  A tela de Trades é a que edita e filtra; aqui a tabela é só leitura, e a
 *  pergunta é outra: o que foi comprado e vendido dentro deste pedaço da
 *  carteira, e quanto disso virou lucro. */
export default function SliceTradesTab({ trades, loading = false }: Props) {
  const { format: formatCurrency } = useCurrency()

  const summary = useMemo(() => {
    let bought = 0
    let sold = 0
    let realized = 0

    for (const trade of trades) {
      if (trade.type === 'Compra') {
        bought += trade.value
      } else {
        sold += trade.value
        realized += trade.realized_profit
      }
    }

    return { bought, sold, realized }
  }, [trades])

  if (!loading && trades.length === 0) {
    return <AppText tone="secondary">Nenhuma operação registrada neste recorte.</AppText>
  }

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack direction="row" gap="lg" wrap>
          <AppMetric label="Operações" value={String(trades.length)} size="lg" />
          <AppMetric label="Comprado" value={formatCurrency(summary.bought)} />
          <AppMetric label="Vendido" value={formatCurrency(Math.abs(summary.sold))} />
          <AppMetric
            label="Lucro realizado"
            value={formatCurrency(summary.realized)}
            tone={summary.realized < 0 ? 'danger' : 'success'}
          />
        </AppStack>
      </AppCard>

      <TradesTable trades={trades} maxHeight={TABLE_MAX_HEIGHT} />
    </AppStack>
  )
}
