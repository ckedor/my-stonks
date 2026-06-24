import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { POSITION_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import api from '@/lib/api'
import PerformanceBarChart, { type DistributionMetric } from '@/pages/portfolio/asset/PerformanceBarChart'
import PortfolioHeatMap from '@/pages/portfolio/asset/PortfolioHeatMap'
import { usePortfolioStore } from '@/stores/portfolio'
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const METRIC_OPTIONS: { value: DistributionMetric; label: string }[] = [
  { value: 'twelve_months_return', label: 'Rent. 12M' },
  { value: 'acc_return', label: 'Rent. Acumulada' },
  { value: 'cagr', label: 'CAGR' },
  { value: 'profit', label: 'Lucro' },
]

export default function DistributionPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const navigate = useNavigate()
  const portfolioId = selectedPortfolio?.id

  const [metric, setMetric] = useState<DistributionMetric>('twelve_months_return')

  const { data: positions } = useCachedData<any[]>(
    portfolioId ? `distribution:positions:${portfolioId}` : null,
    useCallback(
      () => api.get(POSITION_ROUTES.byPortfolio(portfolioId!)).then(r => r.data),
      [portfolioId],
    ),
    { enabled: !!portfolioId },
  )

  const loading = !positions && !!portfolioId

  const handleAssetSelect = useCallback((assetId: number) => {
    navigate(`/portfolio/asset/${assetId}`)
  }, [navigate])

  return (
    <Box pt={2}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Distribuição</Typography>
        <ToggleButtonGroup
          value={metric}
          exclusive
          onChange={(_, v) => v && setMetric(v)}
          size="small"
        >
          {METRIC_OPTIONS.map(opt => (
            <ToggleButton key={opt.value} value={opt.value} sx={{ textTransform: 'none', px: 2 }}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Box display="flex" gap={2} flexDirection={{ xs: 'column', lg: 'row' }}>
          <Box flex="1 1 0" minWidth={0}>
            <PortfolioHeatMap
              positions={positions ?? []}
              metric={metric}
              onAssetSelect={handleAssetSelect}
            />
          </Box>
          <Box mt={5} width={{ xs: '100%', lg: 360 }} flexShrink={0} minWidth={0}>
            <PerformanceBarChart
              positions={positions ?? []}
              metric={metric}
              onAssetSelect={handleAssetSelect}
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}
