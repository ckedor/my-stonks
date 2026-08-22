import { Box, BoxProps } from '@mui/material'
import { radius, space, type SpaceToken } from '@/theme/tokens'

/* ──────────────────────────────────────────────
   AppCard — superfície padrão do app
   ──────────────────────────────────────────────

   Cobre os ~36 `<Box>` que existiam só para desenhar uma superfície
   (fundo, borda, raio).

   Sobre o `sx`: ele continua aqui porque 18 das 47 chamadas atuais passam
   `sx`, e removê-lo agora quebraria páginas que ainda não foram migradas.
   É uma saída de emergência com prazo — some quando as páginas migrarem.
   Código novo não deve usá-lo: se falta algo, a prop entra neste
   componente. O mesmo vale para `noPadding`, hoje substituído por
   `padding="none"`. */

export interface AppCardProps extends Omit<BoxProps, 'padding'> {
  children: React.ReactNode
  /** Espaçamento interno. Padrão: `md`. */
  padding?: SpaceToken
  /** @deprecated Use `padding="none"`. */
  noPadding?: boolean
  /** Piso de largura, em px — o card que não pode espremer o que mostra
   *  quando divide a linha com um vizinho elástico. */
  minWidth?: number
  /** Levanta a superfície com sombra, para o que flutua sobre o conteúdo —
   *  o balão de um gráfico. */
  raised?: boolean
}

export default function AppCard({
  children,
  sx,
  padding,
  noPadding = false,
  minWidth,
  raised = false,
  ...props
}: AppCardProps) {
  const resolvedPadding = padding ?? (noPadding ? 'none' : 'md')

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: `${radius.md}px`,
        p: space[resolvedPadding],
        backgroundColor: 'background.paper',
        ...(minWidth ? { minWidth } : null),
        ...(raised ? { boxShadow: 3 } : null),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
}
