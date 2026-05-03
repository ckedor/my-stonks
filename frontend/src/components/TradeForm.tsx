import { ASSET_TYPES } from '@/constants/assetTypes'
import { BROKER_ROUTES, QUOTE_ROUTES, TRANSACTION_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { Asset, Trade } from '@/types'
import { Delete } from '@mui/icons-material'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Drawer,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs, { Dayjs } from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import AssetSelector from './AssetSelector'

type AssetTypeKey = keyof typeof ASSET_TYPES
const ASSET_TYPE_BY_ID: Record<number, AssetTypeKey> = Object.fromEntries(
  Object.entries(ASSET_TYPES).map(([k, v]) => [v as number, k as AssetTypeKey])
) as Record<number, AssetTypeKey>

interface Currency {
  id: number
  name: string
  code: string
}

interface Broker {
  id: number
  name: string
  legalId: string
  currency: Currency
}

interface Quote {
  close: number
  date: string
}

interface QuoteResponse {
  quotes: Quote[]
  ticker: string
  currency: string
}

interface TradeFormProps {
  open: boolean
  onClose: () => void
  onSave?: () => void
  trade?: Trade
  assetId?: number
  initialAsset?: { id: number; ticker: string; name: string; asset_type_id: number } | null
}

export default function TradeForm({ open, onClose, onSave, trade, assetId, initialAsset }: TradeFormProps) {
  const isEdit = Boolean(trade)
  const { portfolios, selectedPortfolio } = usePortfolioStore()

  const [type, setType] = useState<'Compra' | 'Venda'>('Compra')
  const [quantity, setQuantity] = useState<number>(0)
  const [price, setPrice] = useState<number>(0)
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL')
  const [date, setDate] = useState<Dayjs | null>(dayjs())
  const [brokerId, setBrokerId] = useState<number | ''>('')
  const [portfolioId, setPortfolioId] = useState<number | ''>('')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [touched, setTouched] = useState(false)

  const selectedBroker = brokers.find((b) => b.id === brokerId)
  const isDolar = selectedBroker?.currency.name === 'Dólar'

  // When broker changes, default currency to broker's currency (only when creating).
  useEffect(() => {
    if (isEdit) return
    if (!selectedBroker) return
    setCurrency(isDolar ? 'USD' : 'BRL')
  }, [brokerId, isDolar, isEdit, selectedBroker])

  const isValid =
    quantity > 0 &&
    price > 0 &&
    brokerId !== '' &&
    portfolioId !== '' &&
    (isEdit || selectedAsset !== null)

  useEffect(() => {
    if (trade) {
      setType(trade.type as 'Compra' | 'Venda')
      setQuantity(Math.abs(trade.quantity))
      setPrice(trade.original_price)
      setCurrency((trade.currency as 'BRL' | 'USD') ?? 'BRL')
      setDate(dayjs(trade.date))
      setBrokerId(trade.broker_id)
      setPortfolioId(trade.portfolio_id)
    } else {
      setType('Compra')
      setQuantity(0)
      setPrice(0)
      setCurrency('BRL')
      setDate(dayjs())
      setBrokerId('')
      setPortfolioId(selectedPortfolio?.id ?? '')
      if (initialAsset) {
        setSelectedAsset(initialAsset as Asset)
      } else {
        setSelectedAsset(null)
      }
    }
    setTouched(false)
  }, [trade, open, selectedPortfolio, initialAsset])

  useEffect(() => {
    if (open) {
      api.get(BROKER_ROUTES.list).then((res) => setBrokers(res.data))
    }
  }, [open])

  const assetTypeKey = useMemo<AssetTypeKey | null>(() => {
    const id = selectedAsset?.asset_type_id
    if (id == null) return null
    return ASSET_TYPE_BY_ID[id] ?? null
  }, [selectedAsset])

  async function fetchAndSetPrice() {
    if (!selectedAsset || !assetTypeKey || !date || isEdit) return
    setPriceLoading(true)
    try {
      const d = dayjs(date).format('YYYY-MM-DD')
      const { data } = await api.get<QuoteResponse>(QUOTE_ROUTES.get, {
        params: { ticker: selectedAsset.ticker, asset_type: assetTypeKey, date: d },
      })
      const q =
        data.quotes.find((q) => dayjs(q.date).format('YYYY-MM-DD') === d) ??
        data.quotes[0] ??
        null
      setPrice(q ? Number(q.close) : 0)
    } catch {
      setPrice(0)
    } finally {
      setPriceLoading(false)
    }
  }

  useEffect(() => {
    fetchAndSetPrice()
  }, [selectedAsset, date, assetTypeKey])

  const handleSubmit = async () => {
    setTouched(true)
    if (!isValid) return

    setLoading(true)
    const payload = {
      id: isEdit ? trade?.id : undefined,
      asset_id: isEdit ? assetId : selectedAsset?.id,
      quantity: type === 'Compra' ? quantity : -quantity,
      price: price,
      currency: currency,
      date: date?.toISOString(),
      broker_id: brokerId,
      portfolio_id: portfolioId,
    }

    try {
      if (isEdit && trade?.id) {
        await api.put(TRANSACTION_ROUTES.byId(trade.id), payload)
      } else {
        await api.post(TRANSACTION_ROUTES.create, payload)
      }
      onClose()
      onSave?.()
    } catch {
      setError('Erro ao salvar a operação. Tente novamente.')
      setSnackbarOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!trade?.id) return
    try {
      await api.delete(TRANSACTION_ROUTES.byId(trade.id), {
        data: {
          portfolio_id: portfolioId,
          asset_id: assetId,
        },
      })
      setConfirmOpen(false)
      onClose()
      onSave?.()
    } catch {
      setError('Erro ao deletar a operação.')
      setSnackbarOpen(true)
    }
  }

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose}>
        <Box p={3} width={500} display="flex" flexDirection="column" height="100%">
          <Stack spacing={3} p={1} flex={1} overflow="auto">
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">
                {isEdit ? 'Editar Negociação' : 'Nova Negociação'}
              </Typography>
              {isEdit && (
                <IconButton onClick={() => setConfirmOpen(true)}>
                  <Delete />
                </IconButton>
              )}
            </Box>

            {isEdit ? (
              <TextField
                label="Ativo"
                value={trade?.ticker ?? ''}
                InputProps={{ readOnly: true }}
                fullWidth
              />
            ) : (
              <AssetSelector
                value={selectedAsset?.id ?? null}
                onChange={setSelectedAsset}
                initialAsset={initialAsset}
              />
            )}

            <FormControl fullWidth error={touched && portfolioId === ''}>
              <InputLabel>Carteira</InputLabel>
              <Select
                value={portfolioId}
                label="Carteira"
                onChange={(e) => setPortfolioId(Number(e.target.value))}
              >
                {portfolios.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <DatePicker label="Data" value={date} onChange={setDate} />

            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select value={type} label="Tipo" onChange={(e) => setType(e.target.value as any)}>
                <MenuItem value="Compra">Compra</MenuItem>
                <MenuItem value="Venda">Venda</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Quantidade"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value))}
              error={touched && quantity <= 0}
              helperText={touched && quantity <= 0 ? 'Quantidade deve ser maior que zero' : ''}
              fullWidth
            />

            <TextField
              label={currency === 'USD' ? 'Preço (USD)' : 'Preço (R$)'}
              type="number"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value))}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {priceLoading && <CircularProgress size={18} />}
                  </InputAdornment>
                ),
              }}
              error={touched && price <= 0}
              helperText={touched && price <= 0 ? 'Preço deve ser maior que zero' : ''}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Moeda</InputLabel>
              <Select
                value={currency}
                label="Moeda"
                onChange={(e) => setCurrency(e.target.value as 'BRL' | 'USD')}
              >
                <MenuItem value="BRL">BRL</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth error={touched && brokerId === ''}>
              <InputLabel>Corretora</InputLabel>
              <Select
                value={brokerId}
                label="Corretora"
                onChange={(e) => setBrokerId(Number(e.target.value))}
              >
                {brokers.map((broker) => (
                  <MenuItem key={broker.id} value={broker.id}>
                    {broker.name}
                  </MenuItem>
                ))}
              </Select>
              {touched && brokerId === '' && (
                <Typography variant="caption" color="error">
                  Selecione uma corretora
                </Typography>
              )}
            </FormControl>
          </Stack>

          <Box mt={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleSubmit}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isEdit ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir esta operação? Essa ação não poderá ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button color="error" onClick={handleDelete} autoFocus>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarOpen(false)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  )
}
