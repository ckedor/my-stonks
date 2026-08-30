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
  /** Acende a barra com um halo da própria cor. É para a tela em que o
   *  progresso é a conquista, e não a medida de uma espera — a trilha de
   *  patentes. Fora dela, uma barra que brilha é ruído. */
  glow?: boolean
}

export default function AppProgressBar({
  value,
  tone = 'primary',
  thickness,
  glow = false,
}: AppProgressBarProps) {
  const theme = useAppTheme()

  /* `golden` não é uma cor de paleta do MUI, então ela é pintada à mão. As
     outras duas continuam vindo do `color`, que já trata o trilho.

     Cor e brilho caem os dois sobre `.MuiLinearProgress-bar`, e por isso são
     montados num objeto só: espalhados como dois `sx` irmãos, o segundo
     substituía a chave inteira do primeiro e levava junto a cor. */
  const golden = tone === 'golden'

  const barSx = {
    ...(golden ? { backgroundColor: theme.palette.golden } : {}),
    ...(glow
      ? {
          boxShadow: `0 0 14px ${withOpacity(
            golden ? theme.palette.golden : theme.palette.primary.main,
            0.55,
          )}`,
        }
      : {}),
  }

  /* O trilho escuro é só de quem está sobre a arte, e `glow` é o que marca
     essa tela. Aplicado a toda barra dourada, ele virava uma faixa cinza
     dentro de um card claro — e uma barra escura parada lê como carregando,
     não como progresso. */
  const trackSx =
    golden && glow
      ? {
          backgroundColor: withOpacity('#000000', 0.55),
          boxShadow: `inset 0 0 0 1px ${withOpacity(theme.palette.golden, 0.35)}`,
        }
      : golden
        ? { backgroundColor: withOpacity(theme.palette.golden, 0.18) }
        : {}

  return (
    <LinearProgress
      variant={value === undefined ? 'indeterminate' : 'determinate'}
      value={value}
      color={tone === 'danger' ? 'error' : 'primary'}
      sx={{
        borderRadius: `${theme.radius.sm}px`,
        ...(thickness ? { height: thickness } : {}),
        ...trackSx,
        '& .MuiLinearProgress-bar': barSx,
      }}
    />
  )
}
