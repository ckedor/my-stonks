import { DIVIDEND_BONUS_RATE } from '@/components/city-game/bonuses'
import { AppDialog, AppStack, AppText } from '@/components/ui'
import type { Dividend } from '@/types'

const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** Quantos ativos o aviso nomeia antes de resumir o resto. */
const LISTED = 5

/** O aviso dos dividendos que caíram desde a última visita. Abre enquanto
 *  houver dividendo não anunciado, e fechar é o que o marca como visto — o
 *  bônus já está no saldo antes disso. */
export default function DividendBonusDialog({ dividends, bonusUsd, onClose }: {
  dividends: Dividend[]
  bonusUsd: number
  onClose: () => void
}) {
  const byTicker = new Map<string, number>()
  for (const dividend of dividends) byTicker.set(dividend.ticker, (byTicker.get(dividend.ticker) ?? 0) + dividend.amount)
  const ranked = [...byTicker].sort((a, b) => b[1] - a[1])
  const rest = ranked.slice(LISTED).reduce((sum, [, amount]) => sum + amount, 0)
  const multiplier = 1 + DIVIDEND_BONUS_RATE

  return (
    <AppDialog open={dividends.length > 0} title="Dividendos caíram na conta!" closeLabel="Pegar bônus" onClose={onClose}>
      <AppStack gap="md">
        <AppText variant="bodySmall" tone="secondary">
          Na cidade, dividendo vale {multiplier}×: além do que ele pagou, você ganha outro tanto de bônus para construir.
        </AppText>
        <AppStack gap="xs">
          {ranked.slice(0, LISTED).map(([ticker, amount]) => (
            <AppStack key={ticker} direction="row" justify="between">
              <AppText variant="bodySmall">{ticker}</AppText>
              <AppText variant="bodySmall">{usd.format(amount)}</AppText>
            </AppStack>
          ))}
          {rest > 0 && (
            <AppStack direction="row" justify="between">
              <AppText variant="bodySmall" tone="secondary">Outros {ranked.length - LISTED}</AppText>
              <AppText variant="bodySmall" tone="secondary">{usd.format(rest)}</AppText>
            </AppStack>
          )}
        </AppStack>
        <AppStack direction="row" justify="between" align="baseline">
          <AppText weight="strong">Bônus</AppText>
          <AppText variant="cardValue" tone="success">+{usd.format(bonusUsd)}</AppText>
        </AppStack>
      </AppStack>
    </AppDialog>
  )
}
