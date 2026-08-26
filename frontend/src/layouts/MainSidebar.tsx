import { AppNavRail } from '@/components/ui'
import { useFavoritesStore } from '@/stores/favorites'

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { getNavigationIcon } from './navigation-icons'
import {
  getNavigationSection,
  isNavigationItemActive,
  navigationSections,
  withMostVisited,
} from './navigation'

/* A coluna é um atalho, não a prateleira: cinco entradas mantêm o grupo
   curto o bastante para não empurrar o resto da navegação para fora da
   dobra. */
const RAIL_FAVORITES = 5

const COLLAPSED_KEY = 'nav-rail-collapsed'

/* Recolhida ou expandida é preferência de quem usa, e uma que se percebe
   toda vez que a tela abre: sem guardar, a coluna volta larga a cada
   navegação com recarga e o ajuste precisa ser refeito. `localStorage` pode
   não existir (SSR, navegador com armazenamento bloqueado), e cair para o
   padrão é resposta suficiente — não vale derrubar a tela por causa disso. */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function persistCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, String(value))
  } catch {
    /* Preferência é conforto, não dado: perder não muda o que a tela faz. */
  }
}

export default function MainSidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(readCollapsed)

  const currentSection = getNavigationSection(location.pathname)
  const section = navigationSections.find((s) => s.id === currentSection)!

  const favorites = useFavoritesStore((state) => state.favorites).slice(0, RAIL_FAVORITES)
  const refreshFavorites = useFavoritesStore((state) => state.refresh)
  useEffect(() => {
    if (currentSection === 'mercado') void refreshFavorites()
  }, [currentSection, refreshFavorites])

  const groups = withMostVisited(
    section,
    favorites.map((asset) => ({
      label: asset.ticker ?? asset.name,
      path: `/market/asset/${asset.id}`,
    })),
  )

  return (
    <AppNavRail
      navLabel={`Páginas de ${section.label}`}
      collapsed={collapsed}
      onToggleCollapsed={() =>
        setCollapsed((value) => {
          persistCollapsed(!value)
          return !value
        })
      }
      groups={groups.map((group) => ({
        title: group.title,
        items: group.items.map((item) => ({
          id: item.path,
          label: item.label,
          icon: getNavigationIcon(item.path),
          active: isNavigationItemActive(location.pathname, item.path),
        })),
      }))}
      onSelect={(path) => navigate(path)}
    />
  )
}
