import AppCard from '@/components/ui/AppCard'
import { Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface Props {
  title?: string
  /** Para gráficos que já trazem o próprio espaçamento interno; o título segue
   *  recuado para alinhar com o conteúdo. */
  noPadding?: boolean
  children: ReactNode
}

/** Moldura padrão das seções da página do ativo: um `AppCard` e um título
 *  visível.
 *
 *  Um elemento de cabeçalho, e não `AppCard title`: aquela prop é espalhada no
 *  Box e vira o atributo `title` do DOM, ou seja, só aparece como tooltip do
 *  navegador. Mesmo motivo documentado em `pages/market/asset/AssetQuoteCard`. */
export default function ChartSection({ title, noPadding = false, children }: Props) {
  return (
    <AppCard noPadding={noPadding}>
      {title && (
        <Typography variant="h6" sx={{ mb: 1.5, ...(noPadding ? { px: 2, pt: 2 } : {}) }}>
          {title}
        </Typography>
      )}
      {children}
    </AppCard>
  )
}
