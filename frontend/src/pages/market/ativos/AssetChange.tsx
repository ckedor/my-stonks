import { AppText } from '@/components/ui'

/** A variação do dia, com o sinal explícito: sem ele, uma queda e uma alta
 *  pequenas se parecem demais numa lista longa. Sem cotação, um travessão —
 *  a coluna existe para todas as linhas, inclusive as que não têm preço. */
export default function AssetChange({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return (
      <AppText variant="bodySmall" tone="secondary" inline>
        —
      </AppText>
    )
  }

  return (
    <AppText variant="bodySmall" weight="strong" tone={value >= 0 ? 'success' : 'danger'} inline>
      {value >= 0 ? '+' : ''}
      {value.toFixed(2)}%
    </AppText>
  )
}
