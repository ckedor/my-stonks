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
}

export default function AppCard({
  children,
  sx,
  padding,
  noPadding = false,
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
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
}
