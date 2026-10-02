import { AppShell, AppSidebar, AppTopbar, SIDEBAR_WIDTH, ThemeToggleButton } from '@/components/ui'
import BarChartIcon from '@mui/icons-material/BarChart'
import BrushIcon from '@mui/icons-material/Brush'
import EditNoteIcon from '@mui/icons-material/EditNote'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import LayersIcon from '@mui/icons-material/Layers'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import NumbersIcon from '@mui/icons-material/Numbers'
import PaletteIcon from '@mui/icons-material/Palette'
import TableChartIcon from '@mui/icons-material/TableChart'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import ToggleOnIcon from '@mui/icons-material/ToggleOn'
import TouchAppIcon from '@mui/icons-material/TouchApp'
import type { ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  designSystemFamilyPath,
  THEME_STUDIO_PATH,
  type DesignSystemFamilySlug,
} from './design-system/families'
import { devNavigationItems } from './navigation'

/* A casca das ferramentas de desenvolvimento: o catálogo do design system e o
 * estúdio de temas.
 *
 * Só existe com `npm run dev`. `App.tsx` registra as rotas de `/dev` atrás de
 * `import.meta.env.DEV`, que o build de produção troca por `false`, e as
 * carrega sob demanda — então nada daqui entra no bundle publicado. Também
 * não pede login nem backend: nenhuma tela daqui lê dado do servidor, e
 * exigir os dois para olhar um botão era o custo de morar no admin. */

/* Um ícone por família. O `Record` é o que obriga a família nova a chegar ao
 * menu com o dela. */
const FAMILY_ICONS: Record<DesignSystemFamilySlug, ReactNode> = {
  fundamentos: <PaletteIcon fontSize="small" />,
  texto: <TextFieldsIcon fontSize="small" />,
  acoes: <TouchAppIcon fontSize="small" />,
  escolha: <ToggleOnIcon fontSize="small" />,
  campos: <EditNoteIcon fontSize="small" />,
  feedback: <NotificationsNoneIcon fontSize="small" />,
  espera: <HourglassEmptyIcon fontSize="small" />,
  numeros: <NumbersIcon fontSize="small" />,
  tabelas: <TableChartIcon fontSize="small" />,
  superficies: <LayersIcon fontSize="small" />,
  graficos: <BarChartIcon fontSize="small" />,
}

const ICONS: Record<string, ReactNode> = {
  ...Object.fromEntries(
    (Object.keys(FAMILY_ICONS) as DesignSystemFamilySlug[]).map((slug) => [
      designSystemFamilyPath(slug),
      FAMILY_ICONS[slug],
    ]),
  ),
  [THEME_STUDIO_PATH]: <BrushIcon fontSize="small" />,
}

const SECTION = { id: 'design-system', label: 'Design System' }

export default function DevLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <AppShell
      sidebarOffset={SIDEBAR_WIDTH}
      sidebar={
        <AppSidebar
          title="Dev"
          items={devNavigationItems.map((item) => ({ ...item, icon: ICONS[item.path] }))}
          selectedPath={pathname}
          onNavigate={navigate}
          variant="permanent"
          open
          onClose={() => undefined}
        />
      }
      topbar={
        <AppTopbar
          navLabel="Ferramentas de desenvolvimento"
          sections={[SECTION]}
          selectedSectionId={SECTION.id}
          onSelectSection={() => navigate(devNavigationItems[0].path)}
          brand={{ label: 'My Stonks', onClick: () => navigate('/') }}
        >
          <ThemeToggleButton />
        </AppTopbar>
      }
    >
      <Outlet />
    </AppShell>
  )
}
