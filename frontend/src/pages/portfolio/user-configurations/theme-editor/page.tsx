import {
    useCustomThemesStore,
} from '@/stores/custom-themes'
import { usePageTitleStore } from '@/stores/page-title'
import { useThemeMode } from '@/theme/theme-mode'
import { defaultDarkPalette, defaultLightPalette, type ThemePaletteConfig } from '@/theme/themes'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import {
    Box,
    Button,
    IconButton,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
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
  const { setTitle } = usePageTitleStore()
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

  useEffect(() => {
    setTitle(isEditing ? `Editar Tema — ${name || '...'}` : 'Criar Tema Personalizado')
  }, [setTitle, isEditing, name])

  const handleBaseMode = useCallback(
    (_: unknown, newMode: 'light' | 'dark' | null) => {
      if (newMode && !isEditing) {
        setConfig(getBaseConfig(newMode))
      }
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
    <Box sx={{ mt: 3, pt: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate(-1)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          {isEditing ? 'Editar Tema' : 'Novo Tema Personalizado'}
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!canSave}
          onClick={handleSave}
        >
          Salvar
        </Button>
      </Box>

      {/* Meta fields */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Nome do Tema"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          sx={{ minWidth: 260 }}
          required
        />
        <TextField
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          size="small"
          sx={{ minWidth: 320, flex: 1 }}
        />
        {!isEditing && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={config.mode}
            onChange={handleBaseMode}
          >
            <ToggleButton value="light">Claro</ToggleButton>
            <ToggleButton value="dark">Escuro</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {/* Two-column: form + preview */}
      <Box
        sx={{
          display: 'flex',
          gap: 3,
          flexDirection: { xs: 'column', lg: 'row' },
          alignItems: 'flex-start',
        }}
      >
        {/* Left: palette form */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ThemePaletteForm config={config} onChange={setConfig} />
        </Box>

        {/* Right: live preview (sticky) */}
        <Box
          sx={{
            width: { xs: '100%', lg: '55%' },
            position: { lg: 'sticky' },
            top: { lg: 80 },
          }}
        >
          <ThemePreviewPanel config={config} />
        </Box>
      </Box>
    </Box>
  )
}
