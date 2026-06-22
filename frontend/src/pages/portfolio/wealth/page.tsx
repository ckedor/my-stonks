
import PortfolioPatrimonyChart from '@/components/PortfolioPatrimonyChart'
import AppCard from '@/components/ui/AppCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useCurrency } from '@/hooks/useCurrency'
import { usePortfolioStore } from '@/stores/portfolio'
import { usePatrimonyStore } from '@/stores/portfolio/patrimony'
import {
    Box,
    FormControlLabel,
    Grid,
    MenuItem,
    Paper,
    Select,
    SelectChangeEvent,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import dayjs, { Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import PortfolioMonthlyAportsChart from './PortfolioMonthlyAportsChart'

export default function PortfolioPatrimonyEvolution() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const userCategories = selectedPortfolio?.custom_categories ?? []
  const { symbol } = useCurrency()

  const patrimonyEvolution = usePatrimonyStore(s => s.patrimony)
  const patrimonyLoading = usePatrimonyStore(s => s.loading) && patrimonyEvolution.length === 0

  const loading = patrimonyLoading

  const [selectedCategory, setSelectedCategory] = useState<string>('portfolio')
  const [startDate, setStartDate] = useState<Dayjs | null>(null)
  const [endDate, setEndDate] = useState<Dayjs | null>(null)

  const [showProjection, setShowProjection] = useState(false)
  const [projectionRate, setProjectionRate] = useState(10)
  const [projectionYears, setProjectionYears] = useState(1)
  const [monthlyContribution, setMonthlyContribution] = useState(2000)

  const filteredData = useMemo(() => {
    if (!patrimonyEvolution) return []

    return patrimonyEvolution.filter((entry) => {
      const date = dayjs(entry.date)
      const afterStart = !startDate || date.isSameOrAfter(startDate, 'day')
      const beforeEnd = !endDate || date.isSameOrBefore(endDate, 'day')
      return afterStart && beforeEnd
    })
  }, [patrimonyEvolution, startDate, endDate])

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <Box pt={2}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>Evolução do Patrimônio</Typography>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems="center"
        spacing={3}
        ml={6}
        mb={3}
        pr={5}
        mr={2}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
          <Box minWidth={180}>
            <Select
              fullWidth
              size="small"
              variant="standard"
              value={selectedCategory}
              onChange={(e: SelectChangeEvent) => setSelectedCategory(e.target.value)}
              sx={{
                outline: 'none',
                '&::before, &::after': { borderBottom: '1px solid #ccc' },
                '&:hover:not(.Mui-disabled):before': {
                  borderBottom: '2px solid #1976d2',
                },
              }}
            >
              <MenuItem value="portfolio">Carteira</MenuItem>
              {userCategories.map((cat) => (
                <MenuItem key={cat.id} value={cat.name}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <DatePicker
            value={startDate}
            onChange={(newValue) => setStartDate(newValue)}
            slotProps={{
              textField: {
                size: 'small',
                variant: 'standard',
                sx: {
                  outline: 'none',
                  '& .MuiInput-root::before': { borderBottom: '1px solid #ccc' },
                  '& .MuiInput-root:hover::before': {
                    borderBottom: '2px solid #1976d2',
                  },
                },
              },
            }}
          />

          <DatePicker
            value={endDate}
            onChange={(newValue) => setEndDate(newValue)}
            slotProps={{
              textField: {
                size: 'small',
                variant: 'standard',
                sx: {
                  outline: 'none',
                  '& .MuiInput-root::before': { borderBottom: '1px solid #ccc' },
                  '& .MuiInput-root:hover::before': {
                    borderBottom: '2px solid #1976d2',
                  },
                },
              },
            }}
          />
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            pt: 1,
            border: '1px solid #ddd',
            borderRadius: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={showProjection}
                  onChange={(e) => setShowProjection(e.target.checked)}
                />
              }
              label="Projeção"
            />

            <TextField
              label="Taxa (%)"
              type="number"
              value={projectionRate}
              onChange={(e) => setProjectionRate(Number(e.target.value))}
              variant="standard"
              size="small"
              InputProps={{ inputProps: { min: 0, step: 0.1 } }}
              sx={{ width: 80 }}
            />

            <TextField
              label="Anos"
              type="number"
              value={projectionYears}
              onChange={(e) => setProjectionYears(Number(e.target.value))}
              variant="standard"
              size="small"
              InputProps={{ inputProps: { min: 1, step: 1 } }}
              sx={{ width: 60 }}
            />

            <TextField
              label="Aporte"
              type="number"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(Number(e.target.value))}
              variant="standard"
              size="small"
              InputProps={{
                inputProps: { min: 0, step: 100 },
                startAdornment: <span style={{ marginRight: 4 }}>{symbol}</span>,
              }}
              sx={{ width: 120 }}
            />
          </Stack>
        </Paper>
      </Stack>
      <Grid container spacing={2}>
        <Grid size={12}>
          <AppCard>
            <PortfolioPatrimonyChart
            size={520}
            selected={selectedCategory}
            patrimonyEvolution={filteredData}
            projection={
              showProjection
                ? {
                    rate: projectionRate / 100,
                    years: projectionYears,
                    monthlyContribution,
                  }
                : undefined
            }
          />
          </AppCard>
        </Grid>
        <Grid size={12} sx={{ mt: 0, mb: 4 }}>
          <AppCard>
            <PortfolioMonthlyAportsChart
            height={300}
            groupBy="month"
            defaultRange="max"
          />
          </AppCard>
        </Grid>
      </Grid>

    </Box>
  )
}
