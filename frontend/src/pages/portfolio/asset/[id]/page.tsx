import AssetDetailPanel from '@/components/AssetDetailPanel'
import BackButton from '@/components/ui/BackButton'
import { usePortfolioStore } from '@/stores/portfolio'
import { usePositionsStore } from '@/stores/portfolio/positions'
import type { PortfolioPositionEntry } from '@/types'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import { Box, Button, Drawer, IconButton, InputAdornment, TextField, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from "react-router-dom"

function AssetSearchDrawer({
  positions,
  selectedAssetId,
}: {
  positions: PortfolioPositionEntry[]
  selectedAssetId: number
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const totalValue = useMemo(
    () => positions.reduce((sum, item) => sum + item.value, 0),
    [positions],
  )

  const filteredPositions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return positions

    return positions.filter((position) =>
      [position.ticker, position.name, position.category, position.type, position.class]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    )
  }, [positions, search])

  const grouped = useMemo(() => {
    const map: Record<string, PortfolioPositionEntry[]> = {}
    for (const position of filteredPositions) {
      const category = position.category || 'Sem categoria'
      if (!map[category]) map[category] = []
      map[category].push(position)
    }

    for (const category of Object.keys(map)) {
      map[category].sort((a, b) => b.value - a.value)
    }

    return Object.entries(map).sort(
      ([, a], [, b]) =>
        b.reduce((sum, position) => sum + position.value, 0) -
        a.reduce((sum, position) => sum + position.value, 0),
    )
  }, [filteredPositions])

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<SearchIcon />}
        onClick={() => setOpen(true)}
        sx={{
          fontWeight: 650,
          textTransform: 'none',
        }}
      >
        Buscar ativo
      </Button>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        disableScrollLock
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 420 },
              p: 3,
            },
          },
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 750 }}>
            Trocar ativo
          </Typography>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Buscar por ticker, nome ou categoria"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 2.5 }}
        />

        <Box
          sx={{
            overflowY: 'auto',
            pr: 0.5,
            scrollbarColor: 'rgba(0, 0, 0, 0.22) transparent',
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: 8,
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 0, 0, 0.18)',
              borderRadius: 8,
              border: '2px solid transparent',
              backgroundClip: 'content-box',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.28)',
            },
          }}
        >
          {grouped.map(([category, assets]) => (
            <Box key={category} minWidth={0} sx={{ mb: 2.25 }}>
              <Typography
                variant="overline"
                sx={{
                  display: 'block',
                  color: 'text.secondary',
                  fontWeight: 750,
                  letterSpacing: 1,
                  mb: 0.75,
                }}
              >
                {category}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                {assets.map((asset) => {
                  const selected = asset.asset_id === selectedAssetId
                  return (
                    <Box
                      key={asset.asset_id}
                      onClick={() => {
                        navigate(`/portfolio/asset/${asset.asset_id}`)
                        setOpen(false)
                      }}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: 1.5,
                        alignItems: 'center',
                        px: 1.5,
                        py: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: selected ? 'action.selected' : 'transparent',
                        color: selected ? 'text.primary' : 'text.secondary',
                        '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                      }}
                    >
                      <Box minWidth={0}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: selected ? 750 : 650 }}>
                          {asset.ticker}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {asset.name}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {totalValue > 0 ? `${((asset.value / totalValue) * 100).toFixed(1)}%` : '0,0%'}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          ))}
          {grouped.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Nenhum ativo encontrado.
            </Typography>
          )}
        </Box>
      </Drawer>
    </>
  )
}

export default function PortfolioAssetPage() {
  const { id } = useParams<{ id: string }>()
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const portfolioId = selectedPortfolio?.id
  const positions = usePositionsStore(s => s.positions)
  const assetId = id ? parseInt(id, 10) : null

  if (!portfolioId || !assetId) return null

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1440,
        mx: 'auto',
        px: { xs: 2, md: 4, xl: 5 },
        pt: { xs: 2, md: 3 },
        pb: 5,
      }}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
        gap={2}
        flexWrap="wrap"
        sx={{ mb: 2.5 }}
      >
        <BackButton fallbackHref="/portfolio/asset" />
      </Box>

      <AssetDetailPanel
        assetId={assetId}
        portfolioId={portfolioId}
        assetSelector={<AssetSearchDrawer positions={positions} selectedAssetId={assetId} />}
      />
    </Box>
  )
}
