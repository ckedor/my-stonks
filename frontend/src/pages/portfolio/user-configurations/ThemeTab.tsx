import {
  AppCard,
  AppGrid,
  AppIconButton,
  AppStack,
  AppStackItem,
  AppText,
  AppThemePreview,
  SectionTitle,
} from '@/components/ui'
import { getCustomThemeDefinitions, useCustomThemesStore } from '@/stores/custom-themes'
import { useThemeMode } from '@/theme/theme-mode'
import { darkThemes, lightThemes, type ThemeDefinition } from '@/theme/themes'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import LightModeIcon from '@mui/icons-material/LightMode'
import PaletteIcon from '@mui/icons-material/Palette'
import { useNavigate } from 'react-router-dom'

/* ── Card de tema ──────────────────────────── */
function ThemeCard({
  def,
  selected,
  onSelect,
  isCustom,
  onEdit,
  onDelete,
}: {
  def: ThemeDefinition
  selected: boolean
  onSelect: () => void
  isCustom?: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <AppCard padding="sm" interactive selected={selected} onClick={onSelect}>
      <AppStack gap="sm">
        <AppThemePreview colors={def.preview} />

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

        {isCustom && (
          <AppStack direction="row" gap="xs" justify="end">
            <AppIconButton
              size="sm"
              label="Editar"
              tooltip
              onClick={(event) => {
                event.stopPropagation()
                onEdit?.()
              }}
            >
              <EditIcon fontSize="small" />
            </AppIconButton>
            <AppIconButton
              size="sm"
              tone="error"
              label="Excluir"
              tooltip
              onClick={(event) => {
                event.stopPropagation()
                onDelete?.()
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </AppIconButton>
          </AppStack>
        )}
      </AppStack>
    </AppCard>
  )
}

/* ── Card fantasma "+ Novo Tema" ──────────── */
function NewThemeGhostCard({ onClick }: { onClick: () => void }) {
  return (
    <AppCard dashed interactive onClick={onClick}>
      <AppStack align="center" justify="center" gap="xs">
        <AddIcon fontSize="large" color="disabled" />
        <AppText variant="caption" tone="secondary" weight="strong">
          Novo Tema
        </AppText>
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
  customThemes,
  onEditCustom,
  onDeleteCustom,
  onCreateNew,
}: {
  icon: React.ReactNode
  title: string
  themes: ThemeDefinition[]
  selectedId: string
  onSelect: (id: string) => void
  customThemes?: ThemeDefinition[]
  onEditCustom?: (id: string) => void
  onDeleteCustom?: (id: string) => void
  onCreateNew?: () => void
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

        {customThemes?.map((def) => (
          <ThemeCard
            key={def.id}
            def={def}
            selected={selectedId === def.id}
            onSelect={() => onSelect(def.id)}
            isCustom
            onEdit={() => onEditCustom?.(def.id)}
            onDelete={() => onDeleteCustom?.(def.id)}
          />
        ))}

        {onCreateNew && <NewThemeGhostCard onClick={onCreateNew} />}
      </AppGrid>
    </AppStack>
  )
}

/* ── Tab principal ─────────────────────────── */
export default function ThemeTab() {
  const { lightThemeId, darkThemeId, setLightTheme, setDarkTheme } = useThemeMode()
  const navigate = useNavigate()
  const removeTheme = useCustomThemesStore((s) => s.removeTheme)

  const customDefs = getCustomThemeDefinitions()
  const customLight = customDefs.filter((d) => d.mode === 'light')
  const customDark = customDefs.filter((d) => d.mode === 'dark')

  const handleEdit = (id: string) => navigate(`/portfolio/user-configurations/theme-editor/${id}`)

  const handleDelete = (id: string) => {
    removeTheme(id)
    if (lightThemeId === id) setLightTheme(lightThemes[0].id)
    if (darkThemeId === id) setDarkTheme(darkThemes[0].id)
  }

  return (
    <AppStack gap="xl">
      <ThemeSection
        icon={<LightModeIcon color="warning" />}
        title="Tema Claro"
        themes={lightThemes}
        selectedId={lightThemeId}
        onSelect={setLightTheme}
        customThemes={customLight}
        onEditCustom={handleEdit}
        onDeleteCustom={handleDelete}
        onCreateNew={() => navigate('/portfolio/user-configurations/theme-editor')}
      />

      <ThemeSection
        icon={<DarkModeIcon color="info" />}
        title="Tema Escuro"
        themes={darkThemes}
        selectedId={darkThemeId}
        onSelect={setDarkTheme}
        customThemes={customDark}
        onEditCustom={handleEdit}
        onDeleteCustom={handleDelete}
        onCreateNew={() => navigate('/portfolio/user-configurations/theme-editor')}
      />

      {customDefs.length > 0 && (
        <AppStack direction="row" gap="sm" align="center">
          <PaletteIcon color="secondary" />
          <AppStackItem>
            <AppText tone="secondary" weight="strong">
              {customDefs.length} tema(s) personalizado(s) salvo(s) localmente
            </AppText>
          </AppStackItem>
        </AppStack>
      )}
    </AppStack>
  )
}
