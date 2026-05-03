// app/portfolio/[portfolio_id]/assets/page.tsx

import { POSITION_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { Box, Typography } from '@mui/material'
import { useCallback, useState } from 'react'
import AssetListTable from './AssetList'
import AssetListSkeleton from './AssetListSkeleton'

export default function PortfolioAssetsPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const [groupBy, setGroupBy] = useState<'category' | 'asset' | 'type' | 'class' | 'broker'>('category')
  const portfolioId = selectedPortfolio?.id
  const { currency } = useCurrency()

  const { data: positions } = useCachedData<any[]>(
    portfolioId ? `assets:positions:${portfolioId}:${groupBy}:${currency}` : null,
    useCallback(() => {
      const params: Record<string, string> = { currency }
      if (groupBy === 'broker') params.group_by_broker = 'true'
      return api.get(POSITION_ROUTES.byPortfolio(portfolioId!), { params }).then(r => r.data)
    }, [portfolioId, groupBy, currency]),
    { enabled: !!portfolioId },
  )

  const loading = !positions && !!portfolioId

  return (
    <Box pt={2}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>Ativos em Carteira</Typography>

      {loading ? (
        <AssetListSkeleton />
      ) : (
        <AssetListTable positions={positions ?? []} groupBy={groupBy} onGroupByChange={setGroupBy} />
      )}
    </Box>
  )
}
