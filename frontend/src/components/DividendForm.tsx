
import { DIVIDEND_ROUTES } from '@/constants/routes'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { Asset } from '@/types'
import {
    AppConfirmDialog,
    AppDateField,
    AppFormDrawer,
    AppNumberField,
    AppSnackbar,
    AppTextField,
} from '@/components/ui'
import dayjs, { Dayjs } from 'dayjs'
import { useEffect, useState } from 'react'
import AssetSelector from './AssetSelector'

interface DividendFormProps {
  open: boolean
  onClose: () => void
  onSave?: () => void
  initialAsset?: Asset | null
  dividend?: {
    id: number
    date: string
    amount: number
    asset_id: number
    portfolio_id: number
    ticker: string
  }
}

export default function DividendForm({ open, onClose, onSave, initialAsset, dividend }: DividendFormProps) {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const { symbol } = useCurrency()

  const [portfolioId, setPortfolioId] = useState<number | ''>('')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [date, setDate] = useState<Dayjs | null>(dayjs())
  const [loading, setLoading] = useState(false)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [touched, setTouched] = useState(false)

  const isEdit = Boolean(dividend)
  const isValid = amount > 0 && selectedAsset && portfolioId !== ''

  useEffect(() => {
    if (dividend) {
      setAmount(dividend.amount)
      setDate(dayjs(dividend.date))
      setPortfolioId(dividend.portfolio_id)
      setSelectedAsset({
        id: dividend.asset_id,
        ticker: dividend.ticker,
        name: '',
        asset_type_id: 0,
        asset_type: { id: 0, name: '', short_name: '', asset_class: { id: 0, name: '' } },
        quantity: 0,
        price: 0,
        average_price: 0,
        value: 0,
        acc_return: null,
        twelve_months_return: null,
        currency: { id: 1, name: 'Real' },
      })
    } else {
      setAmount(0)
      setDate(dayjs())
      setPortfolioId(selectedPortfolio?.id ?? '')
      setSelectedAsset(initialAsset ?? null)
    }
    setTouched(false)
  }, [dividend, open, selectedPortfolio, initialAsset])

  const handleSubmit = async () => {
    if (!isValid) return

    setLoading(true)
    const payload = {
      id: isEdit ? dividend?.id : undefined,
      asset_id: selectedAsset?.id,
      amount,
      date: date?.format('YYYY-MM-DD'),
      portfolio_id: portfolioId,
    }

    try {
      if (isEdit && dividend?.id) {
        await api.put(DIVIDEND_ROUTES.byId(dividend.id), payload)
      } else {
        await api.post(DIVIDEND_ROUTES.create, payload)
      }

      onClose()
      if (onSave) onSave()
    } catch (err) {
      console.error('Erro ao enviar provento:', err)
      setError('Erro ao salvar o provento. Tente novamente.')
      setSnackbarOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!dividend?.id) return
    try {
      await api.delete(DIVIDEND_ROUTES.byId(dividend.id))
      setConfirmOpen(false)
      onClose()
      if (onSave) onSave()
    } catch (err) {
      console.error('Erro ao deletar provento:', err)
      setError('Erro ao deletar o provento.')
      setSnackbarOpen(true)
    }
  }

  return (
    <>
      <AppFormDrawer
        open={open}
        onClose={onClose}
        title={isEdit ? 'Editar Provento' : 'Novo Provento'}
        width="sm"
        gap="lg"
        onDelete={isEdit ? () => setConfirmOpen(true) : undefined}
        deleteLabel="Excluir provento"
        submitLabel={isEdit ? 'Atualizar' : 'Cadastrar'}
        onSubmit={handleSubmit}
        submitDisabled={!isValid}
        submitting={loading}
      >
        {isEdit ? (
          <AppTextField label="Ativo" value={dividend?.ticker ?? ''} onChange={() => undefined} readOnly />
        ) : (
          <AssetSelector
            value={selectedAsset?.id ?? null}
            onChange={(asset) => {
              setSelectedAsset(asset)
              setTouched(true)
            }}
            initialAsset={initialAsset ? { id: initialAsset.id, ticker: initialAsset.ticker, name: initialAsset.name, asset_type_id: initialAsset.asset_type_id } : undefined}
          />
        )}

        <AppDateField label="Data" value={date} onChange={setDate} />

        <AppNumberField
          label={`Valor do Provento (${symbol})`}
          size="full"
          density="comfortable"
          value={amount}
          onChange={(value) => {
            setAmount(value)
            setTouched(true)
          }}
          error={touched && amount <= 0}
          helperText={touched && amount <= 0 ? 'Valor deve ser maior que zero' : ''}
        />
      </AppFormDrawer>

      <AppConfirmDialog
        open={confirmOpen}
        title="Confirmar Exclusão"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      >
        Tem certeza que deseja excluir este provento? Essa ação não poderá ser desfeita.
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
