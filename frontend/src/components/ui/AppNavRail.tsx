import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Box, Typography } from '@mui/material'
import { useState, type MouseEvent, type ReactNode } from 'react'
import { radius } from '@/theme/tokens'
import AppMenu from './AppMenu'
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
 * Recolhida, ela sai da tela inteira — e não vira uma faixa de ícones. A
 * faixa devolvia pouco: para recuperar a largura ela precisava largar os
 * rótulos, e um destino sem rótulo é um ícone que se aprende de cor ou não se
 * usa. Quem quer a largura quer a largura toda. Quem guarda esse estado, e
 * quem oferece o botão de trazê-la de volta, é a moldura: o controle mora na
 * barra superior, fora da coluna, e por isso continua ali quando ela some.
 *
 * São duas caixas, e não uma, por causa do fio da direita: quem gruda ao
 * rolar é a lista, mas o fio precisa acompanhar a página inteira. Numa caixa
 * só ele terminava onde o último item termina, no meio da tela. */

const NAV_RAIL_WIDTH = 232

const ITEM_HEIGHT = 38
/* Meia altura do item, para a marca do ativo ficar centrada nele. */
const MARKER_HEIGHT = 18

export interface AppNavRailItem {
  /** Identifica o item e é o que volta em `onSelect`. */
  id: string
  label: string
  /** Alguns grupos, como os ativos acessados recentemente, são listas de
   *  texto e não precisam reservar espaço para um ícone. */
  icon?: ReactNode
  active?: boolean
  /** Destinos que só aparecem quando o item é aberto.
   *
   *  É um menu suspenso, e não uma lista aninhada: a coluna é curta e uma
   *  lista que vem de dado do usuário — as categorias da carteira — não tem
   *  tamanho previsível. Como menu, ela abre do mesmo jeito com a coluna
   *  aberta ou recolhida; aninhada, recolhida viraria uma pilha de ícones
   *  iguais sem rótulo. */
  submenu?: AppNavRailItem[]
}

export interface AppNavRailGroup {
  title: string
  items: AppNavRailItem[]
}

export interface AppNavRailProps {
  /** Rótulo acessível da coluna. */
  navLabel: string
  groups: AppNavRailGroup[]
  /** Recolhida, a coluna não é desenhada. Quem guarda o estado e quem oferece
   *  o controle é a moldura — na barra superior, fora da coluna, para que o
   *  botão continue existindo quando ela não está lá. */
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

  /* Nos temas claros a coluna veste a cor da barra superior, e não a da
     página: as duas se encontram no canto, e uma faixa clara encostada numa
     barra escura lia-se como duas molduras concorrentes em vez de uma só. No
     escuro isso não acontece — barra e página já são vizinhas próximas — e a
     coluna continua acompanhando o conteúdo. Vestindo a barra, os textos vêm
     dela também: sobre esse fundo, `text.secondary` da página some. */
  const wearsTopbar = theme.palette.mode === 'light'
  const bar = theme.palette.topbar
  const idleText = wearsTopbar ? withOpacity(bar.text, 0.72) : theme.palette.text.secondary
  const strongText = wearsTopbar ? bar.activeText : theme.palette.text.primary
  const hoverBg = wearsTopbar ? withOpacity(bar.activeBg, 0.55) : theme.palette.action.hover
  /* O ativo não pode ser o `primary` da página: ele foi escolhido para
     contrastar com o papel claro e, sobre o fundo da barra, apaga. Vestindo a
     barra, o destaque também vem dela — fundo do item ativo e o texto mais
     claro que ela tem. */
  const activeText = wearsTopbar ? bar.activeText : theme.palette.primary.main
  const activeBg = wearsTopbar ? bar.activeBg : withOpacity(theme.palette.primary.main, 0.12)
  const activeHoverBg = wearsTopbar
    ? bar.activeBg
    : withOpacity(theme.palette.primary.main, 0.16)

  /* O item aberto e o botão a que o menu está ancorado. Um de cada vez: dois
     painéis abertos na mesma coluna se sobrepõem. */
  const [openSubmenu, setOpenSubmenu] = useState<{ id: string; anchor: HTMLElement } | null>(
    null,
  )
  const submenuItems = openSubmenu
    ? groups.flatMap((group) => group.items).find((item) => item.id === openSubmenu.id)?.submenu
    : undefined

  /* Recolhida é recolhida: nada desenhado e nada no DOM. Deixá-la com largura
     zero guardaria a navegação inteira atrás de um `overflow: hidden`, onde o
     leitor de tela continua achando. */
  if (collapsed) return null

  return (
    <Box
      component="nav"
      aria-label={navLabel}
      sx={{
        width: NAV_RAIL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid',
        borderColor: 'divider',
        /* Fundo próprio e acima do conteúdo: a trilha de patentes sangra até a
           borda da janela e passa por baixo daqui. Sem uma superfície opaca a
           arte subiria por cima da navegação. */
        bgcolor: wearsTopbar ? bar.background : 'background.default',
        position: 'relative',
        zIndex: 1,
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
          px: 1.5,
          scrollbarWidth: 'thin',
        }}
      >
        {groups.map((group) => (
          <Box key={group.title} sx={{ mb: 1.5 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                px: 1.5,
                pb: 0.5,
                color: idleText,
                fontWeight: 700,
                fontSize: '0.68rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {group.title}
            </Typography>

            {group.items.map((item) => (
              <Box
                key={item.id}
                component="button"
                type="button"
                aria-current={item.active ? 'page' : undefined}
                aria-haspopup={item.submenu ? 'menu' : undefined}
                aria-expanded={item.submenu ? openSubmenu?.id === item.id : undefined}
                onClick={(event: MouseEvent<HTMLElement>) =>
                  item.submenu
                    ? setOpenSubmenu({ id: item.id, anchor: event.currentTarget })
                    : onSelect(item.id)
                }
                sx={{
                  position: 'relative',
                  appearance: 'none',
                  border: 0,
                  width: '100%',
                  minHeight: ITEM_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 1.5,
                  px: 1.5,
                  borderRadius: `${radius.lg}px`,
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: '0.875rem',
                  lineHeight: 1.3,
                  textAlign: 'left',
                  fontWeight: item.active ? 600 : 400,
                  color: item.active ? activeText : idleText,
                  bgcolor: item.active ? activeBg : 'transparent',
                  transition: theme.transitions.create(['background-color', 'color'], {
                    duration: theme.transitions.duration.shortest,
                  }),
                  '&:hover': {
                    bgcolor: item.active ? activeHoverBg : hoverBg,
                    color: item.active ? activeText : strongText,
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
                        bgcolor: activeText,
                      }
                    : undefined,
                }}
              >
                {item.icon != null && (
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
                )}

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

                {/* A seta é o que distingue o item que abre de um que leva
                    direto. */}
                {item.submenu && (
                  <Box
                    sx={{
                      display: 'flex',
                      ml: 'auto',
                      color: 'inherit',
                      '& svg': { fontSize: 18 },
                    }}
                  >
                    <ChevronRightIcon />
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        ))}
      </Box>

      {submenuItems && openSubmenu && (
        <AppMenu
          id={`nav-submenu-${openSubmenu.id}`}
          anchorEl={openSubmenu.anchor}
          open
          onClose={() => setOpenSubmenu(null)}
          placement="beside"
          minWidth={NAV_RAIL_WIDTH}
          options={submenuItems.map((child) => ({
            label: child.label,
            selected: child.active,
            onSelect: () => {
              setOpenSubmenu(null)
              onSelect(child.id)
            },
          }))}
        />
      )}
    </Box>
  )
}
