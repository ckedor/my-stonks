import {
    getCustomThemeDefinitions,
    useCustomThemesStore,
} from '@/stores/custom-themes'
import { useThemeMode } from '@/theme/theme-mode'
import { darkThemes, lightThemes, type ThemeDefinition } from '@/theme/themes'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import LightModeIcon from '@mui/icons-material/LightMode'
import PaletteIcon from '@mui/icons-material/Palette'
import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    IconButton,
    Tooltip,
    Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'

/* ── Mini-preview do layout ────────────────── */
function ThemeMiniPreview({ preview }: { preview: ThemeDefinition['preview'] }) {
  return (
    <Box
      sx={{
        width: '100%',
        aspectRatio: '16 / 9',
        bgcolor: preview.background,
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid rgba(128,128,128,0.20)',
      }}
    >
      {/* Topbar */}
      <Box
        sx={{
          height: '14%',
          bgcolor: preview.topbar,
          display: 'flex',
          alignItems: 'center',
          px: 0.75,
          gap: 0.5,
        }}
      >
        <Box
          sx={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            bgcolor: preview.primary,
          }}
        />
        <Box
          sx={{
            width: 16,
            height: 2.5,
            borderRadius: 1,
            bgcolor: preview.text,
            opacity: 0.4,
          }}
        />
      </Box>

      {/* Body */}
      <Box sx={{ display: 'flex', height: '86%', p: 0.5, gap: 0.4 }}>
        {/* Sidebar */}
        <Box sx={{ width: '18%', bgcolor: preview.sidebar, borderRadius: 0.5, p: 0.4 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: '70%',
                height: 2.5,
                bgcolor: preview.text,
                opacity: 0.2,
                mb: 0.4,
                borderRadius: 0.5,
              }}
            />
          ))}
        </Box>

        {/* Content cards */}
        <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.4 }}>
          {[preview.primary, preview.accent, preview.text, preview.primary].map((color, i) => (
            <Box key={i} sx={{ bgcolor: preview.paper, borderRadius: 0.5, p: 0.4 }}>
              <Box
                sx={{
                  width: '50%',
                  height: 2.5,
                  bgcolor: color,
                  opacity: i > 1 ? 0.2 : 0.7,
                  borderRadius: 0.5,
                }}
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

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
    <Card
      elevation={0}
      sx={{
        border: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        transition: 'all 0.2s ease',
        position: 'relative',
        '&:hover': {
          borderColor: selected ? 'primary.main' : 'text.secondary',
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
    >
      <CardActionArea onClick={onSelect}>
        <Box sx={{ p: 1.5, pb: 0 }}>
          <ThemeMiniPreview preview={def.preview} />
        </Box>

        <CardContent sx={{ pb: '12px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {def.name}
            </Typography>
            {selected && <CheckCircleIcon color="primary" fontSize="small" />}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {def.description}
          </Typography>
        </CardContent>
      </CardActionArea>

      {isCustom && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            px: 1,
            pb: 1,
            gap: 0.5,
          }}
        >
          <Tooltip title="Editar">
            <IconButton size="small" onClick={onEdit}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Excluir">
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Card>
  )
}

/* ── Seção de temas ────────────────────────── */
/* ── Card fantasma "+ Novo Tema" ──────────── */
function NewThemeGhostCard({ onClick }: { onClick: () => void }) {
  return (
    <Card
      elevation={0}
      sx={{
        border: 2,
        borderStyle: 'dashed',
        borderColor: 'divider',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 160,
        '&:hover': {
          borderColor: 'text.secondary',
          transform: 'translateY(-2px)',
          bgcolor: 'action.hover',
        },
      }}
      onClick={onClick}
    >
      <AddIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 0.5 }} />
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        Novo Tema
      </Typography>
    </Card>
  )
}

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
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {icon}
        <Typography variant="h6">{title}</Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: 2,
        }}
      >
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
      </Box>
    </Box>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <ThemeSection
        icon={<LightModeIcon sx={{ color: 'warning.main' }} />}
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
        icon={<DarkModeIcon sx={{ color: 'info.main' }} />}
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
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <PaletteIcon sx={{ color: 'secondary.main' }} />
            <Typography variant="subtitle1" fontWeight={600} color="text.secondary">
              {customDefs.length} tema(s) personalizado(s) salvo(s) localmente
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}
