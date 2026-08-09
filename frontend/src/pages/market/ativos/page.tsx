import { ASSET_ROUTES } from '@/constants/routes'
import { useMarketStore } from '@/stores/market'
import { useTradeFormStore } from '@/stores/trade-form'
import SearchIcon from '@mui/icons-material/Search'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import {
    Box,
    FormControl,
    Grid,
    InputAdornment,
    InputLabel,
    MenuItem,
    Pagination,
    Select,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import api from '../../../lib/api'
import AssetCard from './AssetCard'
import AssetListView from './AssetListView'
import FavoriteAssets from './FavoriteAssets'

const ITEMS_PER_PAGE = 24
const VIEW_MODE_KEY = 'my-stonks:market:view-mode'

type ViewMode = 'card' | 'list'

export default function MarketAtivosPage() {
  const navigate = useNavigate()
  const { openTradeForm } = useTradeFormStore()

  const { assets, assetTypes, loading: marketLoading, setAssets, setAssetTypes, setLoading } = useMarketStore()
  const [error, setError] = useState<string | null>(null)

  const loading = marketLoading && assets.length === 0

  // Filters
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<number | ''>('')
  const [selectedClass, setSelectedClass] = useState<number | ''>('')
  const [page, setPage] = useState(1)

  // Remembered so the browsing style survives a reload.
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null) ?? 'card',
  )
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    const fetchData = async () => {
      // Only show loading spinner if we have no cached data
      if (assets.length === 0) setLoading(true)
      setError(null)
      try {
        const [assetsRes, typesRes] = await Promise.all([
          api.get(ASSET_ROUTES.list),
          api.get(ASSET_ROUTES.type),
        ])
        setAssets(assetsRes.data)
        setAssetTypes(typesRes.data)
      } catch (err) {
        console.error('Erro ao carregar ativos', err)
        if (assets.length === 0) setError('Erro ao carregar ativos do mercado.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const assetClasses = useMemo(() => {
    const classMap = new Map<number, { id: number; name: string }>()
    assetTypes.forEach((type) => {
      if (type.asset_class && !classMap.has(type.asset_class.id)) {
        classMap.set(type.asset_class.id, type.asset_class)
      }
    })
    return Array.from(classMap.values())
  }, [assetTypes])

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesTicker = asset.ticker?.toLowerCase().includes(searchLower)
        const matchesName = asset.name?.toLowerCase().includes(searchLower)
        if (!matchesTicker && !matchesName) return false
      }

      if (selectedType && asset.asset_type_id !== selectedType) return false

      if (selectedClass && asset.asset_type?.asset_class_id !== selectedClass) return false

      return true
    })
  }, [assets, search, selectedType, selectedClass])

  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE)
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filteredAssets.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredAssets, page])

  useEffect(() => {
    setPage(1)
  }, [search, selectedType, selectedClass])

  const filteredTypes = useMemo(() => {
    if (!selectedClass) return assetTypes
    return assetTypes.filter((t) => t.asset_class_id === selectedClass)
  }, [assetTypes, selectedClass])

  if (loading) return <LoadingSpinner />

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">{error}</Typography>
      </Box>
    )
  }

  return (
    <Box pt={2}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <TextField
          placeholder="Buscar por ticker ou nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: 280, flex: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Classe</InputLabel>
          <Select
            value={selectedClass}
            label="Classe"
            onChange={(e) => {
              setSelectedClass(e.target.value as number | '')
              setSelectedType('')
            }}
          >
            <MenuItem value="">Todas</MenuItem>
            {assetClasses.map((cls) => (
              <MenuItem key={cls.id} value={cls.id}>
                {cls.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Tipo</InputLabel>
          <Select
            value={selectedType}
            label="Tipo"
            onChange={(e) => setSelectedType(e.target.value as number | '')}
          >
            <MenuItem value="">Todos</MenuItem>
            {filteredTypes.map((type) => (
              <MenuItem key={type.id} value={type.id}>
                {type.short_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={viewMode}
          onChange={(_, value) => value && setViewMode(value as ViewMode)}
        >
          <ToggleButton value="card" sx={{ px: 1 }}>
            <Tooltip title="Cards">
              <ViewModuleIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="list" sx={{ px: 1 }}>
            <Tooltip title="Lista">
              <ViewListIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <FavoriteAssets />

      {viewMode === 'card' ? (
        <Grid container spacing={2}>
          {paginatedAssets.map((asset) => (
            <Grid key={asset.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <AssetCard
                asset={asset}
                onOpen={() => navigate(`/market/asset/${asset.id}`)}
                onBuy={() =>
                  openTradeForm({
                    id: asset.id,
                    ticker: asset.ticker,
                    name: asset.name,
                    asset_type_id: asset.asset_type_id,
                  })
                }
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <AssetListView
          assets={paginatedAssets}
          onOpen={(asset) => navigate(`/market/asset/${asset.id}`)}
          onBuy={(asset) =>
            openTradeForm({
              id: asset.id,
              // Assets without a ticker (fixed income) are still tradable.
              ticker: asset.ticker ?? '',
              name: asset.name,
              asset_type_id: asset.asset_type_id,
            })
          }
        />
      )}

      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" alignItems="center" gap={2} mt={4}>
          <Typography variant="body2" color="text.secondary">
            {filteredAssets.length} ativos
          </Typography>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Empty state */}
      {filteredAssets.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6">Nenhum ativo encontrado</Typography>
          <Typography variant="body2">Tente ajustar os filtros de busca</Typography>
        </Box>
      )}
    </Box>
  )
}
