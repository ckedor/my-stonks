import { Box, Tooltip, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { radius } from '@/theme/tokens'
import { TOPBAR_HEIGHT } from './AppTopbar'
import { useAppTheme, withOpacity } from './useAppTheme'

/* Coluna de navegação do app: os destinos de dentro da seção corrente.
 *
 * Não é o `AppSidebar`, e a diferença não é de estilo: aquele é a lista
 * rasa e permanente do admin, pintada sobre a cor `sidebar` do tema — uma
 * superfície escura que se lê como moldura. Esta acompanha o conteúdo:
 * mesmo fundo da página, separada por um fio, e o único peso de cor está no
 * item ativo. Numa tela cheia de gráfico, a navegação não deveria ser a
 * coisa mais escura à vista.
 *
 * Recolhida, vira uma faixa de ícones e os rótulos passam para o tooltip.
 * Quem guarda esse estado, e quem oferece o botão de alternar, é a moldura:
 * o controle mora na barra superior, logo acima da coluna, onde não gasta
 * uma linha dela nem muda de lugar conforme o tamanho da seção.
 *
 * São duas caixas, e não uma, por causa do fio da direita: quem gruda ao
 * rolar é a lista, mas o fio precisa acompanhar a página inteira. Numa caixa
 * só ele terminava onde o último item termina, no meio da tela. */

const NAV_RAIL_WIDTH = 232
const NAV_RAIL_COLLAPSED_WIDTH = 64

const ITEM_HEIGHT = 38
/* Meia altura do item, para a marca do ativo ficar centrada nele. */
const MARKER_HEIGHT = 18

export interface AppNavRailItem {
  /** Identifica o item e é o que volta em `onSelect`. */
  id: string
  label: string
  icon: ReactNode
  active?: boolean
}

export interface AppNavRailGroup {
  title: string
  items: AppNavRailItem[]
}

export interface AppNavRailProps {
  /** Rótulo acessível da coluna. */
  navLabel: string
  groups: AppNavRailGroup[]
  /** Recolhida, some com os rótulos. Quem guarda o estado e quem oferece o
   *  controle é a moldura — na barra superior, onde ele não gasta uma linha
   *  da própria coluna. */
  collapsed: boolean
  onSelect: (id: string) => void
}

export default function AppNavRail({
  navLabel,
  groups,
  collapsed,
  onSelect,
}: AppNavRailProps) {
  const theme = useAppTheme()
  const width = collapsed ? NAV_RAIL_COLLAPSED_WIDTH : NAV_RAIL_WIDTH

  return (
    <Box
      component="nav"
      aria-label={navLabel}
      sx={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid',
        borderColor: 'divider',
        transition: theme.transitions.create('width', {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      <Box
        sx={{
          /* Gruda ao rolar em vez de travar a página em `100vh`: o app rola
             inteiro e a lista precisa continuar visível sem mudar isso. Começa
             abaixo da barra superior, que também gruda — em `top: 0` os
             primeiros itens passariam por baixo dela. */
          position: 'sticky',
          top: TOPBAR_HEIGHT,
          maxHeight: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pt: 2,
          pb: 2,
          px: collapsed ? 1 : 1.5,
          scrollbarWidth: 'thin',
          transition: theme.transitions.create('padding', {
            duration: theme.transitions.duration.shorter,
          }),
        }}
      >
        {groups.map((group) => (
          <Box key={group.title} sx={{ mb: 1.5 }}>
            {collapsed ? (
              /* O título não cabe, mas a divisão entre grupos sim: sem ela a
                 faixa vira uma fileira única de ícones sem hierarquia. */
              <Box
                sx={{
                  height: '1px',
                  bgcolor: 'divider',
                  mx: 1.5,
                  mb: 1,
                }}
              />
            ) : (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  px: 1.5,
                  pb: 0.5,
                  color: 'text.secondary',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.title}
              </Typography>
            )}

            {group.items.map((item) => (
              <Tooltip
                key={item.id}
                title={collapsed ? item.label : ''}
                placement="right"
                disableInteractive
              >
                <Box
                  component="button"
                  type="button"
                  aria-current={item.active ? 'page' : undefined}
                  onClick={() => onSelect(item.id)}
                  sx={{
                    position: 'relative',
                    appearance: 'none',
                    border: 0,
                    width: '100%',
                    minHeight: ITEM_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 1.5,
                    px: collapsed ? 0 : 1.5,
                    borderRadius: `${radius.lg}px`,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.875rem',
                    lineHeight: 1.3,
                    textAlign: 'left',
                    fontWeight: item.active ? 600 : 400,
                    color: item.active ? 'primary.main' : 'text.secondary',
                    bgcolor: item.active
                      ? withOpacity(theme.palette.primary.main, 0.12)
                      : 'transparent',
                    transition: theme.transitions.create(['background-color', 'color'], {
                      duration: theme.transitions.duration.shortest,
                    }),
                    '&:hover': {
                      bgcolor: item.active
                        ? withOpacity(theme.palette.primary.main, 0.16)
                        : 'action.hover',
                      color: item.active ? 'primary.main' : 'text.primary',
                    },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                    /* A marca do ativo: um traço curto na borda esquerda. É o
                       que dá a leitura à distância quando a faixa está
                       recolhida e o fundo tingido some sob o ícone. */
                    '&::before': item.active
                      ? {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: `calc(50% - ${MARKER_HEIGHT / 2}px)`,
                          height: MARKER_HEIGHT,
                          width: '3px',
                          borderRadius: `${radius.pill}px`,
                          bgcolor: 'primary.main',
                        }
                      : undefined,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexShrink: 0,
                      color: 'inherit',
                      '& svg': { fontSize: 20 },
                    }}
                  >
                    {item.icon}
                  </Box>

                  {!collapsed && (
                    <Box
                      component="span"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </Box>
                  )}
                </Box>
              </Tooltip>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
