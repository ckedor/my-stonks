import type { ReactNode } from 'react'
import AppStack from './AppStack'
import type { SpaceToken } from '@/theme/tokens'
import { MetricRowContext } from './metric-row'

export interface AppMetricRowProps {
  children: ReactNode
  /** Padrão: `lg`. */
  gap?: SpaceToken
}

/* Uma fileira de `AppMetric`, alinhada.
 *
 * Solta, uma métrica `lg` tem rótulo maior e valor bem mais alto que uma `sm`.
 * Lado a lado e presas pelo topo, isso desalinhava a fileira inteira: os
 * rótulos em alturas diferentes e os números em linhas de base diferentes — o
 * "cabeçalho torto" que aparecia em toda faixa que abre com o número grande.
 *
 * Dentro da fileira todo rótulo tem o mesmo tamanho, e o valor pequeno
 * reserva a altura do grande, assentado embaixo: rótulos numa linha, números
 * noutra. */
export default function AppMetricRow({ children, gap = 'lg' }: AppMetricRowProps) {
  return (
    <MetricRowContext.Provider value>
      <AppStack direction="row" gap={gap} wrap>
        {children}
      </AppStack>
    </MetricRowContext.Provider>
  )
}
