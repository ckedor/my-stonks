import {
  AppCard,
  AppGrid,
  AppStack,
  AppText,
  AppThemePreview,
  SectionTitle,
} from '@/components/ui'
import { useThemeMode } from '@/theme/theme-mode'
import { darkThemes, lightThemes, type ThemeDefinition } from '@/theme/themes'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'

/* ── Card de tema ──────────────────────────── */
function ThemeCard({
  def,
  selected,
  onSelect,
}: {
  def: ThemeDefinition
  selected: boolean
  onSelect: () => void
}) {
  return (
    <AppCard
      padding="sm"
      interactive
      selected={selected}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Aplicar tema ${def.name} ${def.mode === 'light' ? 'claro' : 'escuro'}`}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <AppStack gap="sm">
        <AppThemePreview colors={def.preview} sampleTheme={def.theme} />

        <AppStack gap="none">
          <AppStack direction="row" justify="between" align="center" gap="xs">
            <AppText variant="bodySmall" weight="strong">
              {def.name}
            </AppText>
            {selected && <CheckCircleIcon color="primary" fontSize="small" />}
          </AppStack>
          <AppText variant="caption" tone="secondary">
            {def.description}
          </AppText>
        </AppStack>
      </AppStack>
    </AppCard>
  )
}

/* ── Seção de temas ────────────────────────── */
function ThemeSection({
  icon,
  title,
  themes,
  selectedId,
  onSelect,
}: {
  icon: React.ReactNode
  title: string
  themes: ThemeDefinition[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <AppStack gap="md">
      <AppStack direction="row" gap="sm" align="center">
        {icon}
        <SectionTitle>{title}</SectionTitle>
      </AppStack>

      <AppGrid cols={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap="md">
        {themes.map((def) => (
          <ThemeCard
            key={def.id}
            def={def}
            selected={selectedId === def.id}
            onSelect={() => onSelect(def.id)}
          />
        ))}
      </AppGrid>
    </AppStack>
  )
}

/* ── Tab principal ─────────────────────────── */

/* Só escolha: os temas são os presets de `src/theme/presets.ts`. Criar um tema
 * é trabalho do estúdio de temas, ferramenta de dev que exporta o preset para
 * o código — um editor aqui guardava o tema só no navegador de quem o fez,
 * sem fonte nem borda, e era o segundo editor de tema do app. */
export default function ThemeTab() {
  const { lightThemeId, darkThemeId, setLightTheme, setDarkTheme } = useThemeMode()

  return (
    <AppStack gap="xl">
      <ThemeSection
        icon={<LightModeIcon color="warning" />}
        title="Tema Claro"
        themes={lightThemes}
        selectedId={lightThemeId}
        onSelect={setLightTheme}
      />

      <ThemeSection
        icon={<DarkModeIcon color="info" />}
        title="Tema Escuro"
        themes={darkThemes}
        selectedId={darkThemeId}
        onSelect={setDarkTheme}
      />
    </AppStack>
  )
}
