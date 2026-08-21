import { AppCard, AppStack, SectionTitle } from '@/components/ui'
import type { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
}

/** Moldura padrão das seções da página do ativo: um `AppCard` e um título
 *  visível.
 *
 *  Um elemento de cabeçalho, e não `AppCard title`: aquela prop é espalhada no
 *  Box e vira o atributo `title` do DOM, ou seja, só aparece como tooltip do
 *  navegador. Mesmo motivo documentado em `pages/market/asset/AssetQuoteCard`. */
export default function ChartSection({ title, children }: Props) {
  return (
    <AppCard>
      <AppStack gap="md">
        {title && <SectionTitle>{title}</SectionTitle>}
        {children}
      </AppStack>
    </AppCard>
  )
}
