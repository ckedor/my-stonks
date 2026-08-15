import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import type { ReactNode } from 'react'

/* Barra lateral de navegação.
 *
 * Genérica sobre o conteúdo: recebe os itens prontos e devolve o clique.
 * Quais rotas existem e o que cada uma significa continua sendo
 * conhecimento da área que a usa — aqui só mora a estrutura e o estilo. */

export const SIDEBAR_WIDTH = 240
const FONT_SIZE_LABEL = 16
const FONT_SIZE_HEADER = '1.4rem'

export interface AppSidebarItem {
  /** Identifica o item e é o que volta em `onNavigate`. */
  path: string
  label: string
  icon: ReactNode
}

export interface AppSidebarProps {
  title: string
  items: AppSidebarItem[]
  /** `path` do item ativo. */
  selectedPath: string
  onNavigate: (path: string) => void
  /** `permanent` fica sempre visível; `persistent` abre e fecha. */
  variant: 'permanent' | 'persistent'
  open: boolean
  onClose: () => void
}

export default function AppSidebar({
  title,
  items,
  selectedPath,
  onNavigate,
  variant,
  open,
  onClose,
}: AppSidebarProps) {
  const theme = useTheme()
  const sidebarText = theme.palette.getContrastText(theme.palette.sidebar)

  return (
    <Drawer
      variant={variant}
      open={variant === 'permanent' ? true : open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: SIDEBAR_WIDTH,
          pt: 1,
          pb: 2,
          bgcolor: 'sidebar',
          color: sidebarText,
          borderColor: alpha(sidebarText, 0.18),
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography
          variant="subtitle1"
          align="center"
          sx={{ fontWeight: 'bold', fontSize: FONT_SIZE_HEADER, mt: 1.05 }}
        >
          {title}
        </Typography>

        <Divider sx={{ borderColor: alpha(sidebarText, 0.18), mt: 1.05 }} />

        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          <List dense>
            {items.map((item) => (
              <ListItemButton
                key={item.path}
                onClick={() => {
                  onNavigate(item.path)
                  onClose()
                }}
                selected={selectedPath === item.path}
                sx={{
                  color: sidebarText,
                  '&:hover': {
                    bgcolor: alpha(sidebarText, 0.08),
                  },
                  '&.Mui-selected': {
                    bgcolor: alpha(sidebarText, 0.16),
                    color: sidebarText,
                    '&:hover': {
                      bgcolor: alpha(sidebarText, 0.22),
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 30, color: 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: FONT_SIZE_LABEL }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Box>
    </Drawer>
  )
}
