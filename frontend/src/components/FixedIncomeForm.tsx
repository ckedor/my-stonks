
import { ASSET_CLASS } from '@/constants/assetClass'
import { FIXED_INCOME_TYPES } from '@/constants/fixedIncomeTypes'
import { ASSET_ROUTES, MARKET_DATA_SERIES_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { Asset } from '@/types'
import {
    AppDateField,
    AppFormDrawer,
    AppSelect,
    AppSnackbar,
    AppTextField,
} from '@/components/ui'
import dayjs, { Dayjs } from 'dayjs'
import { useEffect, useMemo, useRef, useState } from 'react'

interface FixedIncomeType {
  id: number
  name: string
  description: string
}

interface IndexOption {
  id: number
  short_name: string
  name: string
}

interface AssetTypeOption {
  id: number
  short_name: string
  asset_class_id: number
}

interface Props {
  open: boolean
  assetTypeId?: number
  onClose: (created?: Asset) => void
}

export default function FixedIncomeForm({ open, assetTypeId, onClose }: Props) {
  const [nickname, setNickname] = useState('')
  const [maturity, setMaturity] = useState<Dayjs | null>(dayjs().add(1, 'year'))
  const [fee, setFee] = useState('')

  const [fiTypeId, setFiTypeId] = useState<number | ''>('')
  const [indexId, setIndexId] = useState<number | ''>('')

  const [assetTypeIdState, setAssetTypeIdState] = useState<number | ''>('')

  const [fiTypes, setFiTypes] = useState<FixedIncomeType[]>([])
  const [indexes, setIndexes] = useState<IndexOption[]>([])
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([])

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snackOpen, setSnackOpen] = useState(false)
  const [touched, setTouched] = useState(false)

  const initFromPropRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setFetching(true)
    Promise.all([
      api.get(ASSET_ROUTES.fixedIncomeType),
      api.get(MARKET_DATA_SERIES_ROUTES.list),
      api.get(ASSET_ROUTES.type),
    ])
      .then(([fiRes, idxRes, atRes]) => {
        setFiTypes(fiRes.data ?? [])
        setIndexes(idxRes.data ?? [])
        setAssetTypes(
          (atRes.data ?? []).filter(
            (t: AssetTypeOption) => t.asset_class_id === ASSET_CLASS.FIXED_INCOME
          )
        )
      })
      .catch(() => {
        setError('Falha ao carregar listas.')
        setSnackOpen(true)
      })
      .finally(() => setFetching(false))
  }, [open])

  useEffect(() => {
    if (!open) {
      initFromPropRef.current = false
      return
    }
    if (initFromPropRef.current) return
    if (assetTypeId && assetTypes.some((t) => t.id === assetTypeId)) {
      setAssetTypeIdState(assetTypeId)
      initFromPropRef.current = true
    }
  }, [open, assetTypeId, assetTypes])

  const selectedFiType = useMemo(() => fiTypes.find((t) => t.id === fiTypeId), [fiTypes, fiTypeId])
  const isPostFixed =
    selectedFiType?.id === FIXED_INCOME_TYPES.INDEX_PLUS ||
    selectedFiType?.id === FIXED_INCOME_TYPES.PERC_INDEX

  useEffect(() => {
    if (!isPostFixed) setIndexId('')
  }, [isPostFixed])

  const formValid =
    nickname.trim().length > 0 &&
    maturity !== null &&
    fee !== '' &&
    fiTypeId !== '' &&
    assetTypeIdState !== '' &&
    (!isPostFixed || indexId !== '')

  const handleSubmit = async () => {
    setTouched(true)
    if (!formValid || !maturity) return
    setLoading(true)
    try {
      const payload = {
        name: nickname.trim(),
        ticker: nickname.trim(),
        asset_type_id: assetTypeIdState,
        fixed_income_type_id: fiTypeId,
        index_id: isPostFixed ? indexId : null,
        fee: Number(fee) / 100,
        maturity_date: maturity.format('YYYY-MM-DD'),
      }
      const resp = await api.post(ASSET_ROUTES.fixedIncome, payload)
      onClose(resp.data as Asset)
      setNickname('')
      setMaturity(dayjs().add(1, 'year'))
      setFee('')
      setFiTypeId('')
      setIndexId('')
      setAssetTypeIdState('')
      setTouched(false)
      initFromPropRef.current = false
    } catch {
      setError('Erro ao criar o ativo.')
      setSnackOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AppFormDrawer
        open={open}
        onClose={() => onClose()}
        title="Novo Ativo de Renda Fixa"
        width="md"
        gap="lg"
        submitLabel="Criar ativo"
        onSubmit={handleSubmit}
        submitDisabled={fetching}
        submitting={loading}
      >
        <AppTextField
          label="Nome"
          value={nickname}
          onChange={setNickname}
          error={touched && nickname.trim().length === 0}
        />

        <AppSelect
          label="Tipo de Ativo"
          size="full"
          density="comfortable"
          error={touched && assetTypeIdState === ''}
          options={assetTypes.map((t) => ({ value: String(t.id), label: t.short_name }))}
          value={assetTypeIdState === '' ? '' : String(assetTypeIdState)}
          onChange={(value) => setAssetTypeIdState(Number(value))}
        />

        <AppSelect
          label="Tipo"
          size="full"
          density="comfortable"
          error={touched && fiTypeId === ''}
          options={fiTypes.map((t) => ({ value: String(t.id), label: `${t.name} - ${t.description}` }))}
          value={fiTypeId === '' ? '' : String(fiTypeId)}
          onChange={(value) => setFiTypeId(Number(value))}
        />

        {isPostFixed && (
          <AppSelect
            label="Indexador"
            size="full"
            density="comfortable"
            error={touched && indexId === ''}
            options={indexes.map((idx) => ({ value: String(idx.id), label: idx.short_name || idx.name }))}
            value={indexId === '' ? '' : String(indexId)}
            onChange={(value) => setIndexId(Number(value))}
          />
        )}

        <AppTextField
          label={isPostFixed ? 'Taxa' : 'Taxa (% a.a. pré)'}
          type="number"
          value={fee}
          onChange={setFee}
          error={touched && fee === ''}
        />

        <AppDateField label="Vencimento" value={maturity} onChange={setMaturity} />
      </AppFormDrawer>

      <AppSnackbar
        open={snackOpen}
        message={error ?? ''}
        severity="error"
        onClose={() => setSnackOpen(false)}
      />
    </>
  )
}
