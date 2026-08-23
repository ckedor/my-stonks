import { Box, Typography } from '@mui/material'
import Drawer from '@mui/material/Drawer'
import CloseIcon from '@mui/icons-material/Close'
import type { ReactNode } from 'react'
import AppIconButton from './AppIconButton'
import { space } from '@/theme/tokens'

/* Painel lateral de leitura: título, um bloco fixo e uma área que rola.
 *
 * Irmão do `AppFormDrawer`, e a diferença é o rodapé. Lá o painel existe
 * para submeter, e o botão preso embaixo é o fim do fluxo; aqui o painel
 * existe para escolher, e a escolha acontece na própria linha da lista —
 * um botão de confirmar seria um passo a mais para dizer o que o clique já
 * disse.
 *
 * Fecha o próprio cabeçalho com o X porque um painel sem rodapé precisa de
 * uma saída visível: `Esc` e o clique fora funcionam, mas nenhum dos dois
 * aparece na tela. */

const WIDTH = { sm: 420, md: 500 } as const

export interface AppSideDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  /** `sm` = 420px, `md` = 500px. No mobile ocupa a tela inteira. */
  width: keyof typeof WIDTH
  /** Bloco fixo entre o título e a área que rola — a busca que precisa
   *  continuar visível enquanto a lista corre. */
  header?: ReactNode
  children: ReactNode
}

export default function AppSideDrawer({
  open,
  onClose,
  title,
  width,
  header,
  children,
}: AppSideDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} disableScrollLock>
      <Box
        p={3}
        sx={{
          width: { xs: '100%', sm: WIDTH[width] },
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={space.md}>
          <Typography variant="h6">{title}</Typography>
          <AppIconButton size="sm" label="Fechar" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </AppIconButton>
        </Box>

        {header && <Box mb={space.md}>{header}</Box>}

        <Box flex={1} overflow="auto">
          {children}
        </Box>
      </Box>
    </Drawer>
  )
}
