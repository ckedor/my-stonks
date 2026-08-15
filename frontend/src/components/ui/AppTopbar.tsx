import MenuIcon from '@mui/icons-material/Menu'
import { AppBar, Box, Toolbar, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import AppIconButton from './AppIconButton'

/* Barra superior com abas de seção e uma área de ações.
 *
 * As abas são as pílulas de navegação; `children` é o que fica à direita
 * (tema, atalhos, conta). Como na barra lateral, a estrutura mora aqui e
 * a lista de seções vem de fora. */

export interface AppTopbarSection {
  id: string
  label: string
}

export interface AppTopbarProps {
  sections: AppTopbarSection[]
  selectedSectionId: string
  onSelectSection: (id: string) => void
  /** Rótulo acessível do grupo de navegação. */
  navLabel: string
  /** Quando presente, mostra o botão de abrir a barra lateral. */
  onMenuClick?: () => void
  /** Ações à direita. */
  children?: ReactNode
}

export default function AppTopbar({
  sections,
  selectedSectionId,
  onSelectSection,
  navLabel,
  onMenuClick,
  children,
}: AppTopbarProps) {
  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'topbar.background',
        color: 'topbar.text',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {onMenuClick && (
            <Box sx={{ color: 'inherit', flexShrink: 0 }}>
              <AppIconButton label="Abrir menu" onClick={onMenuClick} tone="inherit" edge="start">
                <MenuIcon />
              </AppIconButton>
            </Box>
          )}

          <Box
            component="nav"
            aria-label={navLabel}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 0,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {sections.map((section) => {
              const selected = section.id === selectedSectionId
              return (
                <Typography
                  key={section.id}
                  component="button"
                  type="button"
                  onClick={() => onSelectSection(section.id)}
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
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>{children}</Box>
      </Toolbar>
    </AppBar>
  )
}
