import { AppSkeleton, AppStack, AppText } from '@/components/ui'

/* Onde a carteira está: quanto ela vale e quanto ela rende ao ano.
 *
 * Sem superfície própria: o bloco abre a página e é lido como o cabeçalho
 * dela, não como um cartão pousado ali. Numa caixa de métricas, o número
 * grande ao lado dos pequenos desalinhava a fileira; solto, ele é o título. */

export interface PortfolioStandingCardProps {
  /** Quanto a carteira vale hoje. */
  patrimony: number
  /** Retorno anualizado em pontos percentuais. Ausente quando não há série. */
  cagr: number | null
  /** O CAGR como percentual do CDI. Ausente quando não há benchmark. */
  cdiPct: number | null
  cagrPending?: boolean
  cdiPending?: boolean
  /** A formatação de moeda da tela, para o card não escolher a sua. */
  formatCurrency: (value: number) => string
}

export default function PortfolioStandingCard({
  patrimony,
  cagr,
  cdiPct,
  cagrPending = false,
  cdiPending = false,
  formatCurrency,
}: PortfolioStandingCardProps) {
  return (
    <AppStack gap="xs">
      <AppStack gap="none">
        <AppText variant="bodySmall" tone="secondary">
          Patrimônio
        </AppText>
        <AppText variant="pageHeading">{formatCurrency(patrimony)}</AppText>
      </AppStack>

      {(cagrPending || cagr != null) && (
        <AppStack direction="row" gap="sm" align="baseline" wrap>
          {cagrPending ? (
            <AppSkeleton shape="text" width={120} height={20} />
          ) : cagr != null && (
            <AppText
              variant="bodySmall"
              weight="strong"
              tone={cagr >= 0 ? 'success' : 'danger'}
            >
              CAGR {cagr >= 0 ? '+' : ''}
              {cagr.toFixed(2)}%
            </AppText>
          )}
          {cdiPending ? (
            <AppSkeleton shape="text" width={110} height={20} />
          ) : cdiPct != null && (
            <AppText variant="bodySmall" tone="secondary">
              ({cdiPct.toFixed(0)}% do CDI)
            </AppText>
          )}
        </AppStack>
      )}
    </AppStack>
  )
}
