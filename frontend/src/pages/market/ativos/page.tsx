import AppCard from '@/components/ui/AppCard'
import { useMarketStore } from '@/stores/market'
import { useTradeFormStore } from '@/stores/trade-form'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import api from '../../../lib/api'

const ITEMS_PER_PAGE = 24

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

  useEffect(() => {
    const fetchData = async () => {
      // Only show loading spinner if we have no cached data
      if (assets.length === 0) setLoading(true)
      setError(null)
      try {
        const [assetsRes, typesRes] = await Promise.all([
          api.get('/assets/assets'),
          api.get('/assets/types'),
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

  const getTypeColor = (typeName: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error'> = {
      ETF: 'primary',
      FII: 'secondary',
      Ação: 'success',
      BDR: 'warning',
      'Renda Fixa': 'info',
      Cripto: 'error',
    }
    return colors[typeName] || 'default'
  }

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

      </Box>

      <Grid container spacing={2}>
        {paginatedAssets.map((asset) => (
          <Grid key={asset.id} size={{xs: 12, sm: 6, md: 4, lg: 3}}>
            <AppCard
              onClick={() => navigate(`/market/asset/${asset.id}`)}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'background-color 0.2s',
                '&:hover': {
                  bgcolor: 'action.hover',
                  cursor: 'pointer',
                },
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography variant="h6" fontWeight="bold" noWrap sx={{ flex: 1 }}>
                    {asset.ticker || '—'}
                  </Typography>
                  <Chip
                    label={asset.asset_type?.short_name}
                    size="small"
                    color={getTypeColor(asset.asset_type?.short_name)}
                    variant="outlined"
                  />
                </Box>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minHeight: 40,
                  }}
                  title={asset.name}
                >
                  {asset.name}
                </Typography>

                <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                  <Chip
                    label={asset.asset_type?.asset_class?.name}
                    size="small"
                    variant="filled"
                    sx={{ fontSize: '0.7rem' }}
                  />
                  <Tooltip title="Comprar ativo">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        openTradeForm({
                          id: asset.id,
                          ticker: asset.ticker,
                          name: asset.name,
                          asset_type_id: asset.asset_type_id,
                        })
                      }}
                      sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                    >
                      <AddShoppingCartIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </AppCard>
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
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
