import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import CloseIcon from '@mui/icons-material/Close'
import {
  Box,
  Collapse,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'
import { Fragment, useState, type ReactNode } from 'react'
import AppIconButton from './AppIconButton'

/* Navegação lateral do mobile: seções que abrem e fecham, cada uma com os
 * seus grupos de itens.
 *
 * Irmã do `AppSidebar`, não a mesma coisa: aquela é uma lista rasa que fica
 * permanentemente visível no admin; esta é hierárquica e só existe quando a
 * tela é estreita demais para a barra superior.
 *
 * Como as outras, é genérica sobre o conteúdo: recebe a árvore pronta e
 * devolve o `id` escolhido. */

const DRAWER_WIDTH = 280

export interface AppNavDrawerItem {
  /** Identifica o item e é o que volta em `onSelect`. */
  id: string
  label: string
  active?: boolean
  /** Destinos que só aparecem quando o item é aberto. Aqui a lista abre no
   *  lugar, e não num painel suspenso como na coluna do desktop: o drawer
   *  ocupa a tela inteira e já é uma sanfona de seções. */
  submenu?: AppNavDrawerItem[]
}

export interface AppNavDrawerGroup {
  title: string
  items: AppNavDrawerItem[]
}

export interface AppNavDrawerSection {
  id: string
  label: string
  active?: boolean
  groups: AppNavDrawerGroup[]
}

export interface AppNavDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  /** Bloco fixo entre o título e a navegação. */
  header?: ReactNode
  sections: AppNavDrawerSection[]
  /** `id` das seções expandidas. */
  openSectionIds: string[]
  onToggleSection: (id: string) => void
  onSelect: (id: string) => void
}

export default function AppNavDrawer({
  open,
  onClose,
  title,
  header,
  sections,
  openSectionIds,
  onToggleSection,
  onSelect,
}: AppNavDrawerProps) {
  /* Quais itens estão abertos. Mora aqui, e não em quem chama, porque é
     estado de desenho: nada fora do drawer precisa saber. */
  const [openItemIds, setOpenItemIds] = useState<string[]>([])

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: DRAWER_WIDTH, maxWidth: '85vw' } } }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          {title}
        </Typography>
        <AppIconButton label="Fechar menu" size="sm" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </AppIconButton>
      </Box>

      <Divider />

      {header && (
        <>
          <Box sx={{ p: 2 }}>{header}</Box>
          <Divider />
        </>
      )}

      <List disablePadding>
        {sections.map((section) => (
          <Box key={section.id}>
            <ListItemButton onClick={() => onToggleSection(section.id)}>
              <ListItemText
                primary={section.label}
                slotProps={{
                  primary: {
                    sx: {
                      fontWeight: section.active ? 700 : 500,
                      color: section.active ? 'primary.main' : 'text.primary',
                    },
                  },
                }}
              />
              {openSectionIds.includes(section.id) ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>

            <Collapse in={openSectionIds.includes(section.id)} timeout="auto" unmountOnExit>
              {section.groups.map((group) => (
                <Box key={group.title}>
                  {/* Um grupo sozinho repetindo o nome da seção não informa nada */}
                  {!(section.groups.length === 1 && group.title === section.label) && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        px: 3,
                        pt: 1.5,
                        pb: 0.5,
                        color: 'text.secondary',
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {group.title}
                    </Typography>
                  )}
                  {group.items.map((item) => (
                    <Fragment key={item.id}>
                      <ListItemButton
                        onClick={() => {
                          if (item.submenu) {
                            setOpenItemIds((current) =>
                              current.includes(item.id)
                                ? current.filter((id) => id !== item.id)
                                : [...current, item.id],
                            )
                            return
                          }
                          onSelect(item.id)
                          onClose()
                        }}
                        sx={{ pl: 3, py: 0.75 }}
                      >
                        <ListItemText
                          primary={item.label}
                          slotProps={{
                            primary: {
                              sx: {
                                fontSize: '0.9rem',
                                fontWeight: item.active ? 600 : 400,
                                color: item.active ? 'primary.main' : 'text.primary',
                              },
                            },
                          }}
                        />
                        {item.submenu &&
                          (openItemIds.includes(item.id) ? <ExpandLess /> : <ExpandMore />)}
                      </ListItemButton>

                      {item.submenu && (
                        <Collapse in={openItemIds.includes(item.id)} timeout="auto" unmountOnExit>
                          {item.submenu.map((child) => (
                            <ListItemButton
                              key={child.id}
                              onClick={() => {
                                onSelect(child.id)
                                onClose()
                              }}
                              sx={{ pl: 5, py: 0.75 }}
                            >
                              <ListItemText
                                primary={child.label}
                                slotProps={{
                                  primary: {
                                    sx: {
                                      fontSize: '0.9rem',
                                      fontWeight: child.active ? 600 : 400,
                                      color: child.active ? 'primary.main' : 'text.primary',
                                    },
                                  },
                                }}
                              />
                            </ListItemButton>
                          ))}
                        </Collapse>
                      )}
                    </Fragment>
                  ))}
                </Box>
              ))}
            </Collapse>

            <Divider />
          </Box>
        ))}
      </List>
    </Drawer>
  )
}
