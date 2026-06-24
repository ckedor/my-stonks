import { useCurrency } from '@/hooks/useCurrency'
import { formatFixedIncomeDescription, formatFixedIncomeFee } from '@/lib/utils/fixedIncome'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { Asset, AssetAnalysis } from '@/types'
import { Box, Card, CardContent, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material'

interface AssetDetailsCardProps {
  asset: Asset
  embedded?: boolean
  analysis?: AssetAnalysis | null
}

function InfoRow({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" py={0.5}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} color={color ?? 'text.primary'}>
        {value}
      </Typography>
    </Box>
  )
}

function formatReturn(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return { text: '—', color: 'text.secondary' }
  const pct = value * 100
  return {
    text: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
    color: pct > 0 ? 'success.main' : pct < 0 ? 'error.main' : 'text.primary',
  }
}

export default function AssetDetailsCard({ asset, embedded, analysis }: AssetDetailsCardProps) {
  const accReturn = formatReturn(asset.acc_return)
  const twelveReturn = formatReturn(asset.twelve_months_return)
  const { format: formatCurrency } = useCurrency()
  const fixedIncomeDescription = asset.fixed_income
    ? formatFixedIncomeDescription({
        typeName: asset.fixed_income.fixed_income_type?.name,
        typeId: asset.fixed_income.fixed_income_type_id,
        indexName: asset.fixed_income.index?.short_name ?? asset.fixed_income.index?.name,
        fee: asset.fixed_income.fee,
      })
    : ''

  const positions = usePositionsStore((s) => s.positions)
  const totalPortfolioValue = positions.reduce((sum, p) => sum + p.value, 0)
  const assetPct = totalPortfolioValue > 0 ? (asset.value / totalPortfolioValue) * 100 : 0

  // Derived analysis metrics
  const cagr = analysis?.performance_metrics.cagr
  const cdiMetrics = analysis?.performance_metrics.benchmarks_metrics?.['CDI']
  // Pick the first non-CDI benchmark
  const specificBenchmarkEntry = analysis
    ? Object.entries(analysis.performance_metrics.benchmarks_metrics).find(([k]) => k !== 'CDI')
    : undefined
  const specificBmName = specificBenchmarkEntry?.[0]
  const specificBmMetrics = specificBenchmarkEntry?.[1]

  const content = (
    <Box sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box>
            <Typography variant="h5" fontWeight="bold" lineHeight={1.2}>
              {asset.ticker}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                mt: 0.5,
              }}
            >
              {asset.name}
            </Typography>
          </Box>
          <Stack direction="column" spacing={0.5} alignItems="flex-end">
            <Chip
              label={asset.asset_type?.short_name}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={asset.asset_type?.asset_class?.name}
              size="small"
              variant="filled"
              sx={{ fontSize: '0.7rem' }}
            />
          </Stack>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Box textAlign="left">
            <Typography variant="caption" color="text.secondary">
              Valor Total
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {formatCurrency(asset.value)}
            </Typography>
          </Box>
          {assetPct > 0 && (
            <Box sx={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
              <CircularProgress
                variant="determinate"
                value={100}
                size={48}
                thickness={3}
                sx={{ color: 'action.hover', position: 'absolute' }}
              />
              <CircularProgress
                variant="determinate"
                value={assetPct}
                size={48}
                thickness={3}
                sx={{
                  color: 'primary.main',
                  position: 'absolute',
                  '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
                  {assetPct.toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Position info */}
        <InfoRow label="Quantidade" value={asset.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} />
        <InfoRow label="Preço Atual" value={formatCurrency(asset.price)} />
        <InfoRow label="Preço Médio" value={formatCurrency(asset.average_price)} />

        <Divider sx={{ my: 1.5 }} />

        {/* Returns */}
        <InfoRow label="Rentabilidade 12m" value={twelveReturn.text} color={twelveReturn.color} />
        <InfoRow label="Rent. Acumulada" value={accReturn.text} color={accReturn.color} />

        {/* Analysis metrics */}
        {analysis && (
          <>
            <Divider sx={{ my: 1.5 }} />
            {cagr != null && (
              <InfoRow
                label="CAGR"
                value={`${cagr.toFixed(2)}%`}
                color={cagr > 0 ? 'success.main' : cagr < 0 ? 'error.main' : 'text.primary'}
              />
            )}
            {cdiMetrics && (
              <InfoRow
                label="% do CDI"
                value={cdiMetrics.cagr > 0 ? `${((cagr! / cdiMetrics.cagr) * 100).toFixed(0)}%` : '—'}
                color={cagr! > cdiMetrics.cagr ? 'success.main' : 'warning.main'}
              />
            )}
            {specificBmName && specificBmMetrics && (
              <InfoRow
                label={`vs ${specificBmName}`}
                value={`${specificBmMetrics.alpha >= 0 ? '+' : ''}${specificBmMetrics.alpha.toFixed(2)}%`}
                color={specificBmMetrics.alpha >= 0 ? 'success.main' : 'error.main'}
              />
            )}
            <Divider sx={{ my: 1.5 }} />
            <InfoRow
              label="Vol. Anual"
              value={`${(analysis.risk_metrics.annualized_vol * 100).toFixed(2)}%`}
            />
            <InfoRow
              label="Sharpe"
              value={analysis.risk_metrics.sharpe_ratio.toFixed(3)}
              color={analysis.risk_metrics.sharpe_ratio > 0 ? 'success.main' : 'error.main'}
            />
            <InfoRow
              label="Max Drawdown"
              value={`${(analysis.risk_metrics.drawdown.stats.max_drawdown * 100).toFixed(2)}%`}
              color="error.main"
            />
          </>
        )}

        {/* Fixed income details */}
        {asset.fixed_income && (
          <>
            <Divider sx={{ my: 1.5 }} />
            {asset.fixed_income.index?.name && (
              <InfoRow label="Índice" value={asset.fixed_income.index.name} />
            )}
            {asset.fixed_income.fee != null && (
              <InfoRow label="Taxa" value={formatFixedIncomeFee(asset.fixed_income.fee)} />
            )}
            {asset.fixed_income.maturity_date && (
              <InfoRow label="Vencimento" value={String(asset.fixed_income.maturity_date)} />
            )}
            {fixedIncomeDescription && (
              <InfoRow label="Tipo RF" value={fixedIncomeDescription} />
            )}
          </>
        )}

        {/* Fund details */}
        {asset.fund && (
          <>
            <Divider sx={{ my: 1.5 }} />
            {asset.fund.anbima_category && (
              <InfoRow label="Categoria ANBIMA" value={asset.fund.anbima_category} />
            )}
            {asset.fund.anbima_code && (
              <InfoRow label="Código ANBIMA" value={asset.fund.anbima_code} />
            )}
          </>
        )}
    </Box>
  )

  if (embedded) return content

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
      }}
    >
      <CardContent sx={{ flex: 1, p: 0, '&:last-child': { pb: 0 } }}>
        {content}
      </CardContent>
    </Card>
  )
}
