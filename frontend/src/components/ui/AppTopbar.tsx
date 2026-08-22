import MenuIcon from '@mui/icons-material/Menu'
import { AppBar, Box, Button, Divider, Toolbar, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import AppIconButton from './AppIconButton'

/* Barra superior com abas de seção e uma área de ações.
 *
 * As abas são a navegação de primeiro nível; `children` é o que fica à
 * direita (tema, atalhos, conta). Como na barra lateral, a estrutura mora
 * aqui e a lista de seções vem de fora.
 *
 * `layout` carrega as duas formas que o app tem, e carrega as decisões
 * juntas de propósito — foi assim que elas nasceram, e separá-las em uma
 * prop por detalhe é como se acumulam seis botões de estilo numa barra só:
 *
 *   `full`     — a barra do admin, acima de uma barra lateral. Ocupa a
 *                largura toda, fecha com uma régua e marca a seção ativa
 *                com uma pílula.
 *   `centered` — a barra do app, que é a única navegação da tela. Acompanha
 *                a faixa central onde o conteúdo mora, não fecha com régua
 *                (a marca e as abas já separam) e sublinha a seção ativa.
 *
 * Sem seção na lista, nem as abas nem a régua vertical aparecem: é o que a
 * tela estreita pede, com a navegação migrada para o drawer. */

export const CONTENT_MAX_WIDTH = 1600

export interface AppTopbarSection {
  id: string
  label: string
}

export interface AppTopbarProps {
  sections: AppTopbarSection[]
  selectedSectionId: string
  /** Recebe o elemento clicado: uma seção pode abrir um painel
   *  ancorado nele em vez de navegar direto. */
  onSelectSection: (id: string, element: HTMLElement) => void
  /** Rótulo acessível do grupo de navegação. */
  navLabel: string
  /** Quando presente, mostra o botão de abrir a barra lateral. */
  onMenuClick?: () => void
  /** Nome do produto, à esquerda das abas. */
  brand?: { label: string; onClick: () => void }
  /** Padrão: `full`. */
  layout?: 'full' | 'centered'
  /** Ações à direita. */
  children?: ReactNode
}

export default function AppTopbar({
  sections,
  selectedSectionId,
  onSelectSection,
  navLabel,
  onMenuClick,
  brand,
  layout = 'full',
  children,
}: AppTopbarProps) {
  const centered = layout === 'centered'

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{
        ...(centered ? null : { borderBottom: 1, borderColor: 'divider' }),
        bgcolor: 'topbar.background',
        color: 'topbar.text',
      }}
    >
      <Toolbar
        sx={
          centered
            ? { justifyContent: 'space-between', maxWidth: CONTENT_MAX_WIDTH, width: '100%', mx: 'auto' }
            : { justifyContent: 'space-between', gap: 2 }
        }
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: centered ? { xs: 0.5, md: 2 } : 1,
            minWidth: 0,
          }}
        >
          {onMenuClick && (
            <Box sx={{ color: 'inherit', flexShrink: 0 }}>
              <AppIconButton
                label="Abrir menu de navegação"
                onClick={onMenuClick}
                tone="inherit"
                edge="start"
              >
                <MenuIcon />
              </AppIconButton>
            </Box>
          )}

          {brand && (
            <Typography
              variant="h6"
              noWrap
              onClick={brand.onClick}
              sx={{ fontWeight: 'bold', cursor: 'pointer', color: 'topbar.text' }}
            >
              {brand.label}
            </Typography>
          )}

          {brand && sections.length > 0 && (
            <Divider
              orientation="vertical"
              flexItem
              sx={{ mx: 1, borderColor: 'topbar.text', opacity: 0.3 }}
            />
          )}

          {sections.length > 0 && (
            <Box
              component="nav"
              aria-label={navLabel}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: centered ? { xs: 0.5, md: 2 } : 0.5,
                minWidth: 0,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {sections.map((section) => {
                const selected = section.id === selectedSectionId

                if (centered) {
                  return (
                    <Button
                      key={section.id}
                      onClick={(event) => onSelectSection(section.id, event.currentTarget)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: selected ? 'bold' : 'normal',
                        color: 'topbar.text',
                        borderBottom: selected ? 2 : 0,
                        borderColor: 'topbar.text',
                        borderRadius: 0,
                        px: 1.5,
                      }}
                    >
                      {section.label}
                    </Button>
                  )
                }

                return (
                  <Typography
                    key={section.id}
                    component="button"
                    type="button"
                    onClick={(event) => onSelectSection(section.id, event.currentTarget)}
                    sx={{
                      appearance: 'none',
                      border: 0,
                      borderRadius: 1.5,
                      bgcolor: selected ? 'topbar.activeBg' : 'transparent',
                      color: selected ? 'topbar.activeText' : 'topbar.text',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: '0.875rem',
                      fontWeight: selected ? 700 : 500,
                      lineHeight: 1.5,
                      px: 1.5,
                      py: 0.75,
                      whiteSpace: 'nowrap',
                      '&:hover': {
                        bgcolor: selected ? 'topbar.activeBg' : 'action.hover',
                      },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: 2,
                      },
                    }}
                  >
                    {section.label}
                  </Typography>
                )
              })}
            </Box>
          )}
        </Box>

        <Box
          sx={{ display: 'flex', gap: centered ? 1 : 2, alignItems: 'center', flexShrink: 0 }}
        >
          {children}
        </Box>
      </Toolbar>
    </AppBar>
  )
}
