import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Fragment, type ReactNode } from 'react'

/* Barra lateral de navegação.
 *
 * Genérica sobre o conteúdo: recebe os itens prontos e devolve o clique.
 * Quais rotas existem e o que cada uma significa continua sendo
 * conhecimento da área que a usa — aqui só mora a estrutura e o estilo. */

export const SIDEBAR_WIDTH = 240
const FONT_SIZE_LABEL = 16
const FONT_SIZE_HEADER = '1.4rem'
const FONT_SIZE_GROUP = 11

export interface AppSidebarItem {
  /** Identifica o item e é o que volta em `onNavigate`. */
  path: string
  label: string
  icon: ReactNode
  /** O assunto do item. Itens seguidos do mesmo grupo ficam sob um título
   *  só; sem grupo, a lista é corrida. */
  group?: string
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
  // O item mais específico que casa com a rota: `/admin/integrations` é o
  // painel, e não deve ficar marcado quando se está numa rotina abaixo dele.
  const selected = items
    .map((item) => item.path)
    .filter((path) => selectedPath === path || selectedPath.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0]
  const isSelected = (path: string) => path === selected

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
            {items.map((item, index) => {
              const opensGroup = item.group && item.group !== items[index - 1]?.group
              return (
                <Fragment key={item.path}>
                  {opensGroup && (
                    <ListSubheader
                      disableSticky
                      sx={{
                        bgcolor: 'transparent',
                        color: alpha(sidebarText, 0.64),
                        fontSize: FONT_SIZE_GROUP,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        lineHeight: 1,
                        pt: index === 0 ? 1.5 : 2.5,
                        pb: 1,
                      }}
                    >
                      {item.group}
                    </ListSubheader>
                  )}
                  <ListItemButton
                    onClick={() => {
                      onNavigate(item.path)
                      onClose()
                    }}
                    selected={isSelected(item.path)}
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
                </Fragment>
              )
            })}
          </List>
        </Box>
      </Box>
    </Drawer>
  )
}
