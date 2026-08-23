import { LinearProgress } from '@mui/material'
import { useAppTheme, withOpacity } from './useAppTheme'

/* Barra de progresso horizontal.
 *
 * `value` ausente significa progresso indeterminado — é o estado de quem
 * foi enfileirado e ainda não começou a contar itens. A página não escolhe
 * entre `determinate` e `indeterminate`: ela informa se tem número ou não,
 * e o mapeamento fica aqui. */

export interface AppProgressBarProps {
  /** Percentual de 0 a 100. Omitido, a barra fica indeterminada. */
  value?: number
  /** `danger` para execução que falhou. `golden` para conquista — é a mesma
   *  cor com que a tela escreve o degrau seguinte, e ver as duas juntas é o
   *  que faz a barra e o rótulo falarem da mesma coisa. Padrão: `primary`. */
  tone?: 'primary' | 'danger' | 'golden'
  /** Espessura em px. Padrão: `4`, a do MUI. Uma barra que é o assunto do
   *  card, e não um detalhe de rodapé, pede mais peso. */
  thickness?: number
}

export default function AppProgressBar({
  value,
  tone = 'primary',
  thickness,
}: AppProgressBarProps) {
  const theme = useAppTheme()

  /* `golden` não é uma cor de paleta do MUI, então ela é pintada à mão. As
     outras duas continuam vindo do `color`, que já trata o trilho. */
  const goldenSx =
    tone === 'golden'
      ? {
          backgroundColor: withOpacity(theme.palette.golden, 0.18),
          '& .MuiLinearProgress-bar': { backgroundColor: theme.palette.golden },
        }
      : {}

  return (
    <LinearProgress
      variant={value === undefined ? 'indeterminate' : 'determinate'}
      value={value}
      color={tone === 'danger' ? 'error' : 'primary'}
      sx={{
        borderRadius: `${theme.radius.sm}px`,
        ...(thickness ? { height: thickness } : {}),
        ...goldenSx,
      }}
    />
  )
}
