import AppCard from '@/components/ui/AppCard'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import CurrencyBitcoinRoundedIcon from '@mui/icons-material/CurrencyBitcoinRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded'
import NewspaperRoundedIcon from '@mui/icons-material/NewspaperRounded'
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded'
import {
  Box,
  Chip,
  Grid,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  assetPulse,
  brazilRows,
  globalRows,
  marketSeries,
  news,
  portfolioImpacts,
  usRows,
  type AssetPulse,
  type MarketRow,
  type MarketSeries,
  type Trend,
  type Valuation,
} from './mockData'

const changeColor = (value: number) => value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.secondary'
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`
const brazilSeries = marketSeries.filter((series) => ['cdi', 'ipca', 'ibov'].includes(series.key))
const usSeries = marketSeries.filter((series) => ['sp500', 'nasdaq', 'usd'].includes(series.key))
const worldSeries = marketSeries.filter((series) => ['btc', 'msci'].includes(series.key))
const brazilPulse = assetPulse.filter((item) => item.region === 'BR')
const usPulse = assetPulse.filter((item) => item.region === 'US')
const worldPulse = assetPulse.filter((item) => item.region === 'WORLD')
const brazilNews = news.filter((item) => item.region === 'BR')
const usNews = news.filter((item) => item.region === 'US')
const worldNews = news.filter((item) => item.region === 'WORLD')
const brazilImpacts = portfolioImpacts.filter((item) => item.region === 'BR')
const usImpacts = portfolioImpacts.filter((item) => item.region === 'US')
const worldImpacts = portfolioImpacts.filter((item) => item.region === 'WORLD')

function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <Box sx={{ mb: 2 }}>
      {eyebrow && (
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: 1.2 }}>
          {eyebrow}
        </Typography>
      )}
      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</Typography>
      {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{description}</Typography>}
    </Box>
  )
}

function MarketChartCard({ series }: { series: MarketSeries }) {
  const theme = useTheme()
  const gradientId = `market-gradient-${series.key}`
  return (
    <AppCard sx={{ height: 190, p: 2.25 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{series.name}</Typography>
          <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 700 }}>{series.value}</Typography>
        </Box>
        <Chip
          size="small"
          label={`+${series.change12m.toFixed(1).replace('.', ',')}%`}
          sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', fontWeight: 700 }}
        />
      </Stack>
      <Box sx={{ height: 100, mt: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series.data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={series.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={series.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)} pts`, 'Base 100']}
              labelStyle={{ color: theme.palette.text.secondary }}
              contentStyle={{ borderRadius: 8, borderColor: theme.palette.divider, fontSize: 12 }}
            />
            <Area type="monotone" dataKey="value" stroke={series.color} strokeWidth={2} fill={`url(#${gradientId})`} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="caption" color="text.secondary">12 meses · base 100</Typography>
    </AppCard>
  )
}

function TrendBadge({ trend }: { trend: Trend }) {
  const config = {
    Alta: { icon: <ArrowUpwardRoundedIcon sx={{ fontSize: 14 }} />, color: 'success.main' },
    Queda: { icon: <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} />, color: 'error.main' },
    Lateral: { icon: <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />, color: 'text.secondary' },
  }[trend]
  return <Stack direction="row" spacing={0.3} alignItems="center" justifyContent="flex-end" sx={{ color: config.color }}>{config.icon}<Typography variant="caption" sx={{ fontWeight: 700 }}>{trend}</Typography></Stack>
}

function MarketTable({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: MarketRow[] }) {
  return (
    <AppCard noPadding sx={{ overflow: 'hidden', height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Indicador</TableCell>
              <TableCell align="right">Atual</TableCell>
              <TableCell align="right">Mês</TableCell>
              <TableCell align="right">12M</TableCell>
              <TableCell align="right">Tendência</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name} hover>
                <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.name}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.value}</TableCell>
                <TableCell align="right" sx={{ color: changeColor(row.month), fontWeight: 600 }}>{signed(row.month)}</TableCell>
                <TableCell align="right" sx={{ color: changeColor(row.year), fontWeight: 600 }}>{signed(row.year)}</TableCell>
                <TableCell align="right"><TrendBadge trend={row.trend} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </AppCard>
  )
}

function ValuationChip({ value }: { value: Valuation }) {
  const theme = useTheme()
  const colors = {
    Descontado: theme.palette.success.main,
    Neutro: theme.palette.info.main,
    Esticado: theme.palette.warning.main,
  }
  return <Chip size="small" label={value} sx={{ height: 22, bgcolor: alpha(colors[value], 0.12), color: colors[value], fontWeight: 700, fontSize: 11 }} />
}

function AssetPulseCard({ item }: { item: AssetPulse }) {
  return (
    <AppCard sx={{ height: '100%', borderTop: 3, borderTopColor: item.accent }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography>
        <ValuationChip value={item.valuation} />
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: item.accent, fontWeight: 700 }}>{item.change}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.55 }}>{item.summary}</Typography>
    </AppCard>
  )
}

function NewsList({ items }: { items: typeof news }) {
  const theme = useTheme()
  return (
    <Stack spacing={1.5}>
      {items.map((item) => (
        <AppCard key={item.title} sx={{ p: 2.25 }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'grid', placeItems: 'center', flexShrink: 0 }}><NewspaperRoundedIcon fontSize="small" /></Box>
            <Box sx={{ flex: 1 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                <Box><Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800 }}>{item.tag}</Typography><Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.title}</Typography></Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Maio 2026</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>{item.summary}</Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, fontWeight: 600 }}>Leitura de mercado: {item.impact}</Typography>
            </Box>
          </Stack>
        </AppCard>
      ))}
    </Stack>
  )
}

function PortfolioImpactList({ items }: { items: typeof portfolioImpacts }) {
  const theme = useTheme()
  return (
    <AppCard sx={{ p: 0, overflow: 'hidden' }}>
      <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.06), borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.2} alignItems="center"><CurrencyBitcoinRoundedIcon color="primary" /><Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Mapa de impactos</Typography></Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Não é recomendação. Este bloco será conectado às exposições reais da carteira.</Typography>
      </Box>
      {items.map((item, index) => (
        <Box key={item.title} sx={{ px: 2.5, py: 2, borderBottom: index < items.length - 1 ? 1 : 0, borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}><Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.title}</Typography><Chip size="small" label={item.tone} color={item.tone === 'Positivo' ? 'success' : item.tone === 'Atenção' ? 'warning' : 'default'} variant="outlined" /></Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.55 }}>{item.text}</Typography>
        </Box>
      ))}
    </AppCard>
  )
}

interface RegionalPanelProps {
  label: string
  series: MarketSeries[]
  pulse: AssetPulse[]
  tables: { title: string; icon: React.ReactNode; rows: MarketRow[] }[]
  newsItems: typeof news
  impacts: typeof portfolioImpacts
}

function RegionalPanel({ label, series, pulse, tables, newsItems, impacts }: RegionalPanelProps) {
  return (
    <Box sx={{ pt: 3 }}>
      <SectionTitle title={`Termômetro 12M · ${label}`} />
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {series.map((item) => <Grid key={item.key} size={{ xs: 12, sm: 6, lg: series.length === 4 ? 3 : series.length === 3 ? 4 : 6 }}><MarketChartCard series={item} /></Grid>)}
      </Grid>

      <SectionTitle title="Valuation estrutural · preço relativo das classes" />
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {pulse.map((item) => <Grid key={item.name} size={{ xs: 12, sm: 6, lg: pulse.length > 3 ? 4 : 4 }}><AssetPulseCard item={item} /></Grid>)}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {tables.map((table) => <Grid key={table.title} size={{ xs: 12, xl: 12 / tables.length }}><MarketTable {...table} /></Grid>)}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}><SectionTitle eyebrow={`NOTÍCIAS · ${label.toUpperCase()}`} title="O que moveu o mercado" description="Os fatos mais relevantes e seus efeitos." /><NewsList items={newsItems} /></Grid>
        <Grid size={{ xs: 12, lg: 5 }}><SectionTitle eyebrow={`SUA CARTEIRA · ${label.toUpperCase()}`} title="Como isso conversa com você" description="Impactos ilustrativos nas exposições desta região." /><PortfolioImpactList items={impacts} /></Grid>
      </Grid>
    </Box>
  )
}

export default function MarketOverviewTabsPage() {
  const theme = useTheme()
  const [regionTab, setRegionTab] = useState(0)
  return (
    <Box sx={{ pb: 6 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h4" sx={{ fontWeight: 750, letterSpacing: '-0.03em' }}>Visão geral do mercado</Typography>
            <Chip label="MOCK" size="small" variant="outlined" color="warning" />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
          <InsightsRoundedIcon fontSize="small" />
          <Typography variant="caption">Dados ilustrativos para validação visual</Typography>
        </Stack>
      </Stack>

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <AppCard sx={{ height: '100%', p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>Resumo de maio</Typography>
            <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700, maxWidth: 720 }}>
              Juros altos ainda ditam o preço dos ativos, enquanto tecnologia e Bitcoin sustentam o apetite por risco.
            </Typography>
            <Grid container spacing={2.5} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.6 }}>Principal tema · Juros nos EUA</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  A economia americana permaneceu resiliente e adiou a expectativa de cortes mais rápidos pelo Fed. Treasuries subiram, o dólar ganhou força e ativos de duration longa ficaram mais seletivos.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.6 }}>Leitura macro</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  O cenário combina crescimento moderado, desinflação lenta e liquidez ainda restrita. No Brasil, o CDI oferece carrego elevado, mas fiscal e inflação de serviços limitam a queda dos juros longos.
                </Typography>
              </Grid>
            </Grid>
          </AppCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <AppCard sx={{ height: '100%', p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Cotações de referência</Typography>
              <Typography variant="caption" color="text.secondary">Maio 2026</Typography>
            </Stack>

            <Stack spacing={0.75} sx={{ height: 'calc(100% - 34px)' }}>
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.07), display: 'flex', alignItems: 'center' }}>
                <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'minmax(155px, 1.2fr) repeat(3, minmax(58px, 0.65fr))' }, columnGap: 1, alignItems: 'center' }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, mb: { xs: 1.5, sm: 0 }, minWidth: 0 }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: alpha(theme.palette.info.main, 0.12), color: 'info.main', display: 'grid', placeItems: 'center' }}><LanguageRoundedIcon sx={{ fontSize: 19 }} /></Box>
                    <Box><Typography variant="caption" color="text.secondary">Dólar</Typography><Typography variant="h6" sx={{ fontWeight: 750, lineHeight: 1.15 }}>R$ 5,68</Typography></Box>
                  </Stack>
                  <Box><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Mês</Typography><Typography variant="body2" sx={{ color: 'error.main', fontWeight: 700, whiteSpace: 'nowrap' }}>+2,4%</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>12 meses</Typography><Typography variant="body2" sx={{ color: 'error.main', fontWeight: 700, whiteSpace: 'nowrap' }}>+7,8%</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Máxima</Typography><Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>R$ 5,92</Typography></Box>
                </Box>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.07), display: 'flex', alignItems: 'center' }}>
                <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'minmax(155px, 1.2fr) repeat(3, minmax(58px, 0.65fr))' }, columnGap: 1, alignItems: 'center' }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, mb: { xs: 1.5, sm: 0 }, minWidth: 0 }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: alpha(theme.palette.warning.main, 0.13), color: 'warning.main', display: 'grid', placeItems: 'center' }}><CurrencyBitcoinRoundedIcon sx={{ fontSize: 20 }} /></Box>
                    <Box><Typography variant="caption" color="text.secondary">Bitcoin</Typography><Typography variant="h6" sx={{ fontWeight: 750, lineHeight: 1.15, whiteSpace: 'nowrap' }}>US$ 104.280</Typography></Box>
                  </Stack>
                  <Box><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Mês</Typography><Typography variant="body2" sx={{ color: 'success.main', fontWeight: 700, whiteSpace: 'nowrap' }}>+8,7%</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>12 meses</Typography><Typography variant="body2" sx={{ color: 'success.main', fontWeight: 700, whiteSpace: 'nowrap' }}>+62,5%</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Máxima</Typography><Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>US$ 109k</Typography></Box>
                </Box>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.07), display: 'flex', alignItems: 'center' }}>
                <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'minmax(155px, 1.2fr) repeat(3, minmax(58px, 0.65fr))' }, columnGap: 1, alignItems: 'center' }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, mb: { xs: 1.5, sm: 0 }, minWidth: 0 }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main', display: 'grid', placeItems: 'center' }}><AccountBalanceOutlinedIcon sx={{ fontSize: 19 }} /></Box>
                    <Box><Typography variant="caption" color="text.secondary">CDI</Typography><Typography variant="h6" sx={{ fontWeight: 750, lineHeight: 1.15, whiteSpace: 'nowrap' }}>14,65% a.a.</Typography></Box>
                  </Stack>
                  <Box><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Mês</Typography><Typography variant="body2" sx={{ color: 'success.main', fontWeight: 700, whiteSpace: 'nowrap' }}>+1,1%</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>12 meses</Typography><Typography variant="body2" sx={{ color: 'success.main', fontWeight: 700, whiteSpace: 'nowrap' }}>+11,2%</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Máxima</Typography><Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>14,65%</Typography></Box>
                </Box>
              </Box>
            </Stack>
          </AppCard>
        </Grid>
      </Grid>

      <Box component="section" sx={{ mt: 1 }}>
        <Tabs
          value={regionTab}
          onChange={(_, value) => setRegionTab(value)}
          sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontWeight: 650, minHeight: 48 } }}
        >
          <Tab label="Estados Unidos" />
          <Tab label="Brasil" />
          <Tab label="Mundo" />
        </Tabs>

        {regionTab === 0 && <RegionalPanel label="Estados Unidos" series={usSeries} pulse={usPulse} tables={[{ title: 'Estados Unidos', icon: <ShowChartRoundedIcon fontSize="small" />, rows: usRows }]} newsItems={usNews} impacts={usImpacts} />}
        {regionTab === 1 && <RegionalPanel label="Brasil" series={brazilSeries} pulse={brazilPulse} tables={[{ title: 'Brasil', icon: <AccountBalanceOutlinedIcon fontSize="small" />, rows: brazilRows }]} newsItems={brazilNews} impacts={brazilImpacts} />}
        {regionTab === 2 && <RegionalPanel label="Mundo" series={worldSeries} pulse={worldPulse} tables={[{ title: 'Mundo e ativos globais', icon: <LanguageRoundedIcon fontSize="small" />, rows: globalRows }]} newsItems={worldNews} impacts={worldImpacts} />}
      </Box>
    </Box>
  )
}
