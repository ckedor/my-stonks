import { BROKER_ROUTES, QUOTE_ROUTES, TRANSACTION_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { Asset, Trade } from '@/types'
import {
    AppConfirmDialog,
    AppDateField,
    AppFormDrawer,
    AppNumberField,
    AppSelect,
    AppSnackbar,
    AppTextField,
} from '@/components/ui'
import dayjs, { Dayjs } from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import AssetSelector from './AssetSelector'

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

interface QuotesResponse {
  quotes: Quote[]
  ticker: string
  currency: string | null
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

  const fetchAndSetPrice = useCallback(async () => {
    if (!selectedAsset || !date || isEdit) return
    setPriceLoading(true)
    try {
      const d = dayjs(date).format('YYYY-MM-DD')
      const { data } = await api.get<QuotesResponse>(QUOTE_ROUTES.onDemand, {
        params: {
          ticker: selectedAsset.ticker,
          asset_type_id: selectedAsset.asset_type_id,
          start_date: d,
        },
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
  }, [date, isEdit, selectedAsset])

  useEffect(() => {
    fetchAndSetPrice()
  }, [fetchAndSetPrice])

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
      <AppFormDrawer
        open={open}
        onClose={onClose}
        title={isEdit ? 'Editar Negociação' : 'Nova Negociação'}
        width="md"
        gap="lg"
        onDelete={isEdit ? () => setConfirmOpen(true) : undefined}
        deleteLabel="Excluir negociação"
        submitLabel={isEdit ? 'Atualizar' : 'Cadastrar'}
        onSubmit={handleSubmit}
        submitting={loading}
      >
        {isEdit ? (
          <AppTextField label="Ativo" value={trade?.ticker ?? ''} onChange={() => undefined} readOnly />
        ) : (
          <AssetSelector
            value={selectedAsset?.id ?? null}
            onChange={setSelectedAsset}
            initialAsset={initialAsset}
          />
        )}

        <AppSelect
          label="Carteira"
          size="full"
          density="comfortable"
          error={touched && portfolioId === ''}
          options={portfolios.map((p) => ({ value: String(p.id), label: p.name }))}
          value={portfolioId === '' ? '' : String(portfolioId)}
          onChange={(value) => setPortfolioId(Number(value))}
        />

        <AppDateField label="Data" value={date} onChange={setDate} />

        <AppSelect
          label="Tipo"
          size="full"
          density="comfortable"
          options={[
            { value: 'Compra', label: 'Compra' },
            { value: 'Venda', label: 'Venda' },
          ]}
          value={type}
          onChange={(value) => setType(value as 'Compra' | 'Venda')}
        />

        <AppNumberField
          label="Quantidade"
          size="full"
          density="comfortable"
          value={quantity}
          onChange={setQuantity}
          error={touched && quantity <= 0}
          helperText={touched && quantity <= 0 ? 'Quantidade deve ser maior que zero' : ''}
        />

        <AppNumberField
          label={currency === 'USD' ? 'Preço (USD)' : 'Preço (R$)'}
          size="full"
          density="comfortable"
          value={price}
          onChange={setPrice}
          busy={priceLoading}
          error={touched && price <= 0}
          helperText={touched && price <= 0 ? 'Preço deve ser maior que zero' : ''}
        />

        <AppSelect
          label="Moeda"
          size="full"
          density="comfortable"
          options={[
            { value: 'BRL', label: 'BRL' },
            { value: 'USD', label: 'USD' },
          ]}
          value={currency}
          onChange={(value) => setCurrency(value as 'BRL' | 'USD')}
        />

        <AppSelect
          label="Corretora"
          size="full"
          density="comfortable"
          error={touched && brokerId === ''}
          helperText={touched && brokerId === '' ? 'Selecione uma corretora' : ''}
          options={brokers.map((broker) => ({ value: String(broker.id), label: broker.name }))}
          value={brokerId === '' ? '' : String(brokerId)}
          onChange={(value) => setBrokerId(Number(value))}
        />
      </AppFormDrawer>

      <AppConfirmDialog
        open={confirmOpen}
        title="Confirmar Exclusão"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      >
        Tem certeza que deseja excluir esta operação? Essa ação não poderá ser desfeita.
      </AppConfirmDialog>

      <AppSnackbar
        open={snackbarOpen}
        message={error ?? ''}
        severity="error"
        onClose={() => setSnackbarOpen(false)}
      />
    </>
  )
}
