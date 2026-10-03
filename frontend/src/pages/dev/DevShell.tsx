import { AppNavRail, AppPageShell, AppThemeScope, AppTopbar, ThemeToggleButton } from '@/components/ui'
import { useNavRailCollapsed } from '@/hooks/useNavRailCollapsed'
import type { ThemePreset } from '@/theme/presets'
import BarChartIcon from '@mui/icons-material/BarChart'
import BrushIcon from '@mui/icons-material/Brush'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
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
import { useLocation, useNavigate } from 'react-router-dom'
import {
  designSystemFamilyPath,
  THEME_STUDIO_PATH,
  type DesignSystemFamilySlug,
} from './design-system/families'
import { devNavigationItems } from './navigation'

/* A casca das ferramentas de desenvolvimento: o catálogo do design system e o
 * estúdio de temas.
 *
 * É a moldura do app — `AppPageShell`, `AppTopbar`, `AppNavRail` —, e não uma
 * própria: o estúdio desenha o tema em edição sobre ela, e uma moldura que
 * não fosse a da carteira mostraria um tema aplicado a outra coisa.
 *
 * O estúdio a usa direto, e não como rota-mãe, porque é ele quem tem o que
 * ela precisa: o tema em edição, que pinta a casca inteira, e o painel de
 * tokens à direita.
 *
 * Só existe com `npm run dev`. `App.tsx` registra as rotas de `/dev` atrás de
 * `import.meta.env.DEV`, que o build de produção troca por `false`, e as
 * carrega sob demanda — então nada daqui entra no bundle publicado. Também
 * não pede login nem backend: nenhuma tela daqui lê dado do servidor. */

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

/* Os grupos do menu, na ordem da lista: itens seguidos do mesmo grupo ficam
 * sob um título só. */
const GROUPS = devNavigationItems.reduce<{ title: string; paths: string[] }[]>((groups, item) => {
  const last = groups[groups.length - 1]
  if (last?.title === item.group) last.paths.push(item.path)
  else groups.push({ title: item.group, paths: [item.path] })
  return groups
}, [])

export interface DevShellProps {
  children: ReactNode
  /** O tema que pinta a casca inteira. Sem ele, o tema do app. */
  theme?: ThemePreset
  /** Painel à direita do conteúdo. */
  aside?: { label: string; content: ReactNode }
}

export default function DevShell({ children, theme, aside }: DevShellProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [railCollapsed, toggleRail] = useNavRailCollapsed()

  const shell = (
    <AppPageShell
      aside={aside}
      sidebar={
        <AppNavRail
          navLabel="Ferramentas de desenvolvimento"
          collapsed={railCollapsed}
          groups={GROUPS.map((group) => ({
            title: group.title,
            items: group.paths.map((path) => ({
              id: path,
              label: devNavigationItems.find((item) => item.path === path)!.label,
              icon: ICONS[path],
              active: pathname === path,
            })),
          }))}
          onSelect={(path) => navigate(path)}
        />
      }
      topbar={
        <AppTopbar
          layout="centered"
          navLabel="Ferramentas de desenvolvimento"
          sections={[SECTION]}
          selectedSectionId={SECTION.id}
          onSelectSection={() => navigate(devNavigationItems[0].path)}
          brand={{ label: 'My Stonks', onClick: () => navigate('/') }}
          menuButton={{
            label: railCollapsed ? 'Expandir menu' : 'Recolher menu',
            icon: railCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />,
            onClick: toggleRail,
          }}
        >
          {/* Sob o tema em edição, trocar o modo do app não muda nada à
              vista: o botão sairia sem efeito. */}
          {!theme && <ThemeToggleButton />}
        </AppTopbar>
      }
    >
      {children}
    </AppPageShell>
  )

  return theme ? (
    <AppThemeScope palette={theme.palette} shape={theme.shape}>
      {shell}
    </AppThemeScope>
  ) : (
    shell
  )
}
