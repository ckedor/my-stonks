import { LinearProgress } from '@mui/material'
import { radius } from '@/theme/tokens'

/* Barra de progresso horizontal.
 *
 * `value` ausente significa progresso indeterminado — é o estado de quem
 * foi enfileirado e ainda não começou a contar itens. A página não escolhe
 * entre `determinate` e `indeterminate`: ela informa se tem número ou não,
 * e o mapeamento fica aqui. */

export interface AppProgressBarProps {
  /** Percentual de 0 a 100. Omitido, a barra fica indeterminada. */
  value?: number
  /** `danger` para execução que falhou. Padrão: `primary`. */
  tone?: 'primary' | 'danger'
}

export default function AppProgressBar({ value, tone = 'primary' }: AppProgressBarProps) {
  return (
    <LinearProgress
      variant={value === undefined ? 'indeterminate' : 'determinate'}
      value={value}
      color={tone === 'danger' ? 'error' : 'primary'}
      sx={{ borderRadius: `${radius.sm}px` }}
    />
  )
}
