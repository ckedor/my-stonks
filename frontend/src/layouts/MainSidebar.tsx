import { AppNavRail } from '@/components/ui'
import { useFavoritesStore } from '@/stores/favorites'

import { useEffect } from 'react'
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

export default function MainSidebar({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()

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
