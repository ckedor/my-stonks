
import { syncDividends } from '@/actions/portfolio'
import DividendForm from '@/components/DividendForm'
import DividendsCategoryChart from '@/components/DividendsCategoryChart'
import AppCard from '@/components/ui/AppCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useCurrency } from '@/hooks/useCurrency'
import { getLast12MonthDividendStats } from '@/lib/utils/dividends'
import { usePortfolioStore } from '@/stores/portfolio'
import { useDividendsStore } from '@/stores/portfolio/dividends'
import type { Dividend } from '@/types'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'

export default function PortfolioDividendsPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const userCategories = selectedPortfolio?.custom_categories ?? []

  const dividends = useDividendsStore(s => s.dividends)
  const dividendsLoading = useDividendsStore(s => s.loading) && dividends.length === 0
  const { format: formatCurrency } = useCurrency()

  const loading = dividendsLoading
  const [selectedTicker, setSelectedTicker] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year())

  const [formOpen, setFormOpen] = useState(false)
  const [selectedDividend, setSelectedDividend] = useState<Dividend | null>(null)

  const filteredDividends = useMemo(() => {
    return dividends
      .filter((d) => {
        const matchTicker = selectedTicker ? d.ticker === selectedTicker : true
        const matchCategory = selectedCategory ? d.category === selectedCategory : true
        return matchTicker && matchCategory
      })
      .sort((a, b) => (dayjs(b.date).isAfter(dayjs(a.date)) ? 1 : -1))
  }, [dividends, selectedTicker, selectedCategory])

  const categories = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => d.category))).sort()
  }, [dividends])

  const categoryColors: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {}
    userCategories.forEach((cat) => {
      map[cat.name] = cat.color
    })
    return map
  }, [userCategories])

  const tickers = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => d.ticker))).sort()
  }, [dividends])

  const years = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => dayjs(d.date).year())))
      .sort((a, b) => b - a)
  }, [dividends])

  // Total received in selected year
  const totalYear = useMemo(() => {
    return filteredDividends
      .filter((d) => dayjs(d.date).year() === selectedYear)
      .reduce((sum, d) => sum + d.amount, 0)
  }, [filteredDividends, selectedYear])

  const { total: total12m, average: average12m } = useMemo(
    () => getLast12MonthDividendStats(dividends),
    [dividends],
  )

  // Category totals for legend
  const categoryTotals = useMemo(() => {
    const yearDividends = filteredDividends.filter((d) => dayjs(d.date).year() === selectedYear)
    const map: Record<string, number> = {}
    yearDividends.forEach((d) => {
      map[d.category] = (map[d.category] ?? 0) + d.amount
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filteredDividends, selectedYear])

  // Dividends for the table (year-filtered)
  const tableDividends = useMemo(() => {
    return filteredDividends.filter((d) => dayjs(d.date).year() === selectedYear)
  }, [filteredDividends, selectedYear])

  return (
    <Box pt={2}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>Proventos</Typography>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Summary cards */}
          <Box display="flex" gap={2} mb={3} flexWrap="wrap">
            <AppCard sx={{ flex: '1 1 200px', maxWidth: 280 }}>
              <Typography variant="caption" color="text.secondary">
                Recebidos nos últimos 12 meses
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                {formatCurrency(total12m)}
              </Typography>
            </AppCard>
            <AppCard sx={{ flex: '1 1 200px', maxWidth: 280 }}>
              <Typography variant="caption" color="text.secondary">
                Média dos últimos 12 meses
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                {formatCurrency(average12m)}
              </Typography>
            </AppCard>
            <AppCard sx={{ flex: '1 1 200px', maxWidth: 280 }}>
              <Typography variant="caption" color="text.secondary">
                Total em {selectedYear}
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                {formatCurrency(totalYear)}
              </Typography>
            </AppCard>
          </Box>

          {/* Filters */}
          <Box display="flex" gap={2} mb={3} alignItems="center" flexWrap="wrap">
            <Autocomplete
              options={tickers}
              value={selectedTicker || null}
              onChange={(_, newValue) => setSelectedTicker(newValue || '')}
              renderInput={(params) => <TextField {...params} label="Ativo" size="small" />}
              sx={{ minWidth: 200, flex: '0 1 240px' }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Categoria</InputLabel>
              <Select
                value={selectedCategory}
                label="Categoria"
                onChange={(e: SelectChangeEvent) => setSelectedCategory(e.target.value)}
              >
                <MenuItem value="">Todas</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 90 }}>
              <InputLabel>Ano</InputLabel>
              <Select
                value={String(selectedYear)}
                label="Ano"
                onChange={(e: SelectChangeEvent) => setSelectedYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <MenuItem key={y} value={String(y)}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="small"
              onClick={() => {
                setSelectedDividend(null)
                setFormOpen(true)
              }}
              sx={{ textTransform: 'none', px: 3 }}
            >
              + Novo
            </Button>
          </Box>

          {/* Chart */}
          <AppCard sx={{ mb: 3, p: 0 }}>
            <Box sx={{ p: 2, pb: 0 }}>
              <DividendsCategoryChart
                dividends={filteredDividends}
                categoryColors={categoryColors}
                year={selectedYear}
                size={320}
              />
            </Box>
            {categoryTotals.length > 0 && (
              <Box
                display="flex"
                gap={2}
                flexWrap="wrap"
                sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
              >
                {categoryTotals.map(([cat, total]) => (
                  <Box key={cat} display="flex" alignItems="center" gap={0.5}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '2px',
                        bgcolor: categoryColors[cat] ?? 'primary.main',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {cat}
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {formatCurrency(total)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </AppCard>

          {/* Table */}
          <AppCard noPadding>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>Data</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>Ativo</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>Categoria</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }} align="right">Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableDividends.map((dividend) => (
                    <TableRow
                      key={dividend.id}
                      hover
                      sx={{
                        cursor: 'pointer',
                        '&:last-child td': { borderBottom: 0 },
                      }}
                      onClick={() => {
                        setSelectedDividend(dividend)
                        setFormOpen(true)
                      }}
                    >
                      <TableCell sx={{ fontSize: '0.85rem' }}>
                        {dayjs(dividend.date).format('DD/MM/YYYY')}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{dividend.ticker}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={dividend.category}
                          size="small"
                          sx={{
                            fontSize: '0.72rem',
                            height: 22,
                            bgcolor: categoryColors[dividend.category] ? `${categoryColors[dividend.category]}22` : 'action.selected',
                            color: categoryColors[dividend.category] ?? 'text.primary',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={dividend.amount >= 0 ? 'success.main' : 'error.main'}
                        >
                          {dividend.amount >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(dividend.amount))}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tableDividends.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        Nenhum provento encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </AppCard>
        </>
      )}

      <DividendForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={() => {
          setFormOpen(false)
          if (selectedPortfolio) syncDividends(selectedPortfolio.id, true)
        }}
        dividend={selectedDividend ?? undefined}
      />
    </Box>
  )
}
