import {
    useCustomThemesStore,
} from '@/stores/custom-themes'
import { useThemeMode } from '@/theme/theme-mode'
import { defaultDarkPalette, defaultLightPalette, type ThemePaletteConfig } from '@/theme/themes'
import {
  AppButton,
  AppGrid,
  AppGridItem,
  AppPageHeader,
  AppStack,
  AppStackItem,
  AppTextField,
  AppToggleGroup,
} from '@/components/ui'
import SaveIcon from '@mui/icons-material/Save'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ThemePaletteForm from './ThemePaletteForm'
import ThemePreviewPanel from './ThemePreviewPanel'

function getBaseConfig(mode: 'light' | 'dark'): ThemePaletteConfig {
  return structuredClone(mode === 'light' ? defaultLightPalette : defaultDarkPalette)
}

export default function ThemeEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setLightTheme, setDarkTheme } = useThemeMode()

  const existingEntry = useCustomThemesStore((s) =>
    s.themes.find((t) => t.id === id),
  )
  const addTheme = useCustomThemesStore((s) => s.addTheme)
  const updateTheme = useCustomThemesStore((s) => s.updateTheme)

  const isEditing = !!id && !!existingEntry

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [config, setConfig] = useState<ThemePaletteConfig>(() => getBaseConfig('light'))

  useEffect(() => {
    if (existingEntry) {
      setName(existingEntry.name)
      setDescription(existingEntry.description)
      setConfig(structuredClone(existingEntry.config))
    }
  }, [existingEntry])

  const handleBaseMode = useCallback(
    (newMode: 'light' | 'dark') => {
      if (!isEditing) setConfig(getBaseConfig(newMode))
    },
    [isEditing],
  )

  const canSave = useMemo(() => name.trim().length > 0, [name])

  const handleSave = () => {
    if (!canSave) return

    if (isEditing) {
      updateTheme(id!, { name: name.trim(), description: description.trim(), config })
      navigate(-1)
    } else {
      const newId = addTheme({ name: name.trim(), description: description.trim(), config })
      if (config.mode === 'light') setLightTheme(newId)
      else setDarkTheme(newId)
      navigate(-1)
    }
  }

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title={isEditing ? 'Editar tema' : 'Novo tema personalizado'}
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Configurações', href: '/portfolio/user-configurations' },
          { label: isEditing ? 'Editar tema' : 'Novo tema' },
        ]}
        actions={
          <AppButton icon={<SaveIcon />} disabled={!canSave} onClick={handleSave}>
            Salvar
          </AppButton>
        }
      />

      {/* Nome, descrição e o tema de base */}
      <AppStack direction="row" gap="md" align="center" wrap>
        <AppStackItem minWidth={260}>
          <AppTextField label="Nome do Tema" value={name} onChange={setName} />
        </AppStackItem>
        <AppStackItem grow={2} minWidth={320}>
          <AppTextField label="Descrição" value={description} onChange={setDescription} />
        </AppStackItem>
        {!isEditing && (
          <AppToggleGroup
            label="Tema de base"
            options={[
              { value: 'light' as const, label: 'Claro' },
              { value: 'dark' as const, label: 'Escuro' },
            ]}
            value={config.mode}
            onChange={handleBaseMode}
          />
        )}
      </AppStack>

      {/* Formulário à esquerda, amostra ao vivo à direita */}
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="lg" align="start">
        <AppGridItem span={{ xs: 1, lg: 5 }}>
          <ThemePaletteForm config={config} onChange={setConfig} />
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 7 }}>
          <ThemePreviewPanel config={config} />
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
