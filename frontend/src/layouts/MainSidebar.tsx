import { useSelectedPortfolio } from '@/queries/portfolio'
import { AppNavRail } from '@/components/ui'
import { useFavoritesStore } from '@/stores/favorites'
import { useEffect } from 'react'

import { useLocation, useNavigate } from 'react-router-dom'

import { getNavigationIcon } from './navigation-icons'
import {
  getNavigationSection,
  isNavigationItemActive,
  navigationSections,
  resolveGroups,
} from './navigation'

/** Quantos atalhos a coluna comporta sem virar uma segunda lista. */
const FAVORITES_IN_RAIL = 6

export default function MainSidebar({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()

  const currentSection = getNavigationSection(location.pathname)
  const section = navigationSections.find((s) => s.id === currentSection)!

  const categories = useSelectedPortfolio()?.custom_categories

  /* Os acessados recentemente são um grupo da coluna, e não uma prateleira de
     cards dentro dela: para quem olha, é mais um caminho para uma tela — e um
     caminho tem a forma dos outros caminhos. */
  const { favorites, refresh } = useFavoritesStore()
  useEffect(() => {
    void refresh()
  }, [refresh])

  const groups = resolveGroups(section, {
    categories: (categories ?? []).map((category) => ({
      label: category.name,
      path: `/portfolio/category/${category.id}`,
    })),
  })

  return (
    <AppNavRail
      navLabel={`Páginas de ${section.label}`}
      collapsed={collapsed}
      groups={[
        ...groups.map((group) => ({
          title: group.title,
          items: group.items.map((item) => ({
            id: item.path,
            label: item.label,
            icon: getNavigationIcon(item.path),
            active: isNavigationItemActive(location.pathname, item.path),
            submenu: item.items?.map((child) => ({
              id: child.path,
              label: child.label,
              icon: getNavigationIcon(child.path),
              active: isNavigationItemActive(location.pathname, child.path),
            })),
          })),
        })),
        ...(currentSection === 'mercado' && favorites.length
          ? [
              {
                title: 'Acessados recentemente',
                items: favorites.slice(0, FAVORITES_IN_RAIL).map((asset) => ({
                  id: `/market/asset/${asset.id}`,
                  label: asset.ticker ?? asset.name,
                  active: location.pathname === `/market/asset/${asset.id}`,
                })),
              },
            ]
          : []),
      ]}
      onSelect={(path) => navigate(path)}
    />
  )
}
