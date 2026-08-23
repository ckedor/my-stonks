import { useCurrency } from '@/hooks/useCurrency'
import { useAnalysisStore } from '@/stores/portfolio/analysis'
import { useDividendsStore } from '@/stores/portfolio/dividends'
import { usePatrimonyStore } from '@/stores/portfolio/patrimony'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { useTradeFormStore } from '@/stores/trade-form'
import { useWealthTierStore } from '@/stores/portfolio/wealth-tier'
import { Box, Button, Grid, Tab, Tabs, Typography } from '@mui/material'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OverviewAportsChart from './OverviewAportsChart'
import OverviewDividendsChart from './OverviewDividendsChart'
import OverviewPatrimonyChart from './OverviewPatrimonyChart'
import OverviewReturnsChart from './OverviewReturnsChart'
import OverviewSkeleton from './OverviewSkeleton'
import PositionPieChart from './PositionPieChart'
import PositionTable from './PositionTable'
import PortfolioStandingCard from './PortfolioStandingCard'
import { AppIllustration } from '@/components/ui'

const OVERVIEW_PANEL_HEIGHT = 360
/* Só o padrão de quem ainda não tem altura própria cadastrada. A altura real e
   o ajuste vertical são por arte, no CRUD de patentes. */
const TIER_ARTWORK_HEIGHT = 220
/* Onde o bloco de patrimônio termina e a arte começa. */
const STANDING_CARD_WIDTH = 320

export default function PortfolioOverviewPage() {
  const navigate = useNavigate()
  const { openTradeForm } = useTradeFormStore()

  const positions = usePositionsStore(s => s.positions)
  const positionsLoading = usePositionsStore(s => s.loading)
  const patrimonyEvolution = usePatrimonyStore(s => s.patrimony)
  const dividends = useDividendsStore(s => s.dividends)
  const returnsLoading = useReturnsStore(s => s.loading)
  const categoryCagr = useReturnsStore(s => s.categoryCagr)

  const wealthTierStanding = useWealthTierStore(s => s.standing)
  const tier = wealthTierStanding?.current_tier ?? null

  const { analysis } = useAnalysisStore()
  const { format: formatCurrency } = useCurrency()

  const totalValue = positions.reduce((s, p) => s + p.value, 0)
  const cagrRaw = categoryCagr['portfolio'] ?? null
  const cagr = cagrRaw != null ? cagrRaw * 100 : null
  const cdiMetrics = analysis?.performance_metrics?.benchmarks_metrics?.['CDI']
  const cdiCagr = cdiMetrics?.cagr
  const cdiPct = cagr != null && cdiCagr != null && cdiCagr !== 0
    ? ((cagr / cdiCagr) * 100)
    : null

  const hasCagr = Object.keys(categoryCagr).length > 0
  const loading = (positionsLoading && positions.length === 0) || (returnsLoading && !hasCagr)

  const [selectedCategory, setSelectedCategory] = useState<string>('portfolio')
  const [bottomTab, setBottomTab] = useState(0)

  // The chart matches the height the category list has with its drawers closed.
  // Measured from the data, never from interaction, so expanding a category
  // grows the list without dragging the chart along with it.
  const positionListRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(OVERVIEW_PANEL_HEIGHT)

  useLayoutEffect(() => {
    const node = positionListRef.current
    if (!node) return
    setChartHeight(Math.max(node.offsetHeight, OVERVIEW_PANEL_HEIGHT))
  }, [positions.length])

  if (loading) {
    return <OverviewSkeleton />
  }

  if (!loading && positions.length === 0) {
    return (
      <Box
        height="80vh"
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
      >
        <Typography variant="h6" gutterBottom>
          Sua carteira ainda está vazia
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Comece cadastrando sua primeira compra
        </Typography>
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={() => openTradeForm()}
        >
          Cadastrar Primeira Compra
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* ── Hero: patrimônio e patente, um bloco só ── */}
      {/* A arte fica à direita do bloco e fora do fluxo: assim ela desce sobre
          o gráfico pelo `artwork_offset` sem empurrar nada, e a altura da faixa
          continua sendo a do texto. Sem receber cliques — ela cobre um pedaço
          do gráfico e roubaria o cursor do tooltip. */}
      <Box sx={{ mb: 6, position: 'relative' }}>
        <Box sx={{ maxWidth: STANDING_CARD_WIDTH }}>
          <PortfolioStandingCard
            patrimony={totalValue}
            cagr={cagr}
            cdiPct={cdiPct}
            standing={wealthTierStanding}
            formatCurrency={formatCurrency}
          />
        </Box>

        {tier?.artwork && (
          <Box
            sx={{
              position: 'absolute',
              left: STANDING_CARD_WIDTH,
              top: tier.artwork_offset,
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <AppIllustration
              src={tier.artwork}
              height={tier.artwork_height ?? TIER_ARTWORK_HEIGHT}
            />
          </Box>
        )}
      </Box>

      {/* ── Row 1: Returns chart (70%) + Pie (30%) ── */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <OverviewReturnsChart size={OVERVIEW_PANEL_HEIGHT} selectedCategory={selectedCategory} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <PositionPieChart
            positions={positions}
            height={OVERVIEW_PANEL_HEIGHT}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            onAssetSelect={(assetId) => navigate(`/portfolio/asset/${assetId}`)}
          />
        </Grid>
      </Grid>

      {/* ── Row 2: Position list + Dividends/Patrimony tab ── */}
      <Grid container spacing={3} sx={{ mt: 2 }} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box ref={positionListRef}>
            <PositionTable
              positions={positions}
              selectedCategory={selectedCategory}
              onCategorySelect={setSelectedCategory}
              onAssetSelect={(assetId) => navigate(`/portfolio/asset/${assetId}`)}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Box sx={{ height: chartHeight, display: 'flex', flexDirection: 'column' }}>
            <Tabs
              value={bottomTab}
              onChange={(_, v) => setBottomTab(v)}
              sx={{
                minHeight: 32,
                mb: 1.5,
                flexShrink: 0,
                '& .MuiTabs-indicator': {
                  height: 2,
                  borderRadius: 1,
                },
                '& .MuiTab-root': {
                  minHeight: 32,
                  textTransform: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                  px: 1.5,
                  py: 0.3,
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    fontWeight: 600,
                    color: 'text.primary',
                  },
                },
              }}
            >
              <Tab label="Proventos" />
              <Tab label="Patrimônio" />
              <Tab label="Aportes" />
            </Tabs>

            <Box sx={{ flex: 1, minHeight: 0 }}>
              {bottomTab === 0 && (
                <OverviewDividendsChart
                  dividends={dividends}
                  selected={selectedCategory}
                  size="100%"
                />
              )}
              {bottomTab === 1 && (
                <OverviewPatrimonyChart
                  patrimonyEvolution={patrimonyEvolution}
                  selected={selectedCategory}
                  size="100%"
                />
              )}
              {bottomTab === 2 && (
                <OverviewAportsChart
                  patrimonyEvolution={patrimonyEvolution}
                  size="100%"
                />
              )}
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
