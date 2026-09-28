import { createContext } from 'react'

/** Verdadeiro dentro de uma `AppMetricRow`: a métrica sabe que tem vizinhas
 *  na mesma linha e desenha o rótulo e o valor na geometria comum a todas. */
export const MetricRowContext = createContext(false)
