
import { ASSET_CLASS } from '@/constants/assetClass'
import { FIXED_INCOME_TYPES } from '@/constants/fixedIncomeTypes'
import { ASSET_ROUTES, INDEX_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { Asset } from '@/types'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Drawer,
    FormControl,
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
  const [fee, setFee] = useState<number | ''>('')

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
      api.get(INDEX_ROUTES.list),
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
      <Drawer anchor="right" open={open} onClose={() => onClose()}>
        <Box p={3} width={500} display="flex" flexDirection="column" height="100%" position="relative">
          <Stack spacing={3} p={1} flex={1} overflow="auto">
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Novo Ativo de Renda Fixa</Typography>
            </Box>

            <TextField
              label="Nome"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              error={touched && nickname.trim().length === 0}
              fullWidth
            />

            <FormControl fullWidth error={touched && assetTypeIdState === ''}>
              <InputLabel>Tipo de Ativo</InputLabel>
              <Select
                value={assetTypeIdState}
                label="Tipo de Ativo"
                onChange={(e) => setAssetTypeIdState(Number(e.target.value))}
              >
                {assetTypes.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.short_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth error={touched && fiTypeId === ''}>
              <InputLabel>Tipo</InputLabel>
              <Select value={fiTypeId} label="Tipo" onChange={(e) => setFiTypeId(Number(e.target.value))}>
                {fiTypes.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name} - {t.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {isPostFixed && (
              <FormControl fullWidth error={touched && indexId === ''}>
                <InputLabel>Indexador</InputLabel>
                <Select value={indexId} label="Indexador" onChange={(e) => setIndexId(Number(e.target.value))}>
                  {indexes.map((idx) => (
                    <MenuItem key={idx.id} value={idx.id}>
                      {idx.short_name || idx.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label={isPostFixed ? 'Taxa' : 'Taxa (% a.a. pré)'}
              type="number"
              value={fee}
              onChange={(e) => setFee(e.target.value === '' ? '' : Number(e.target.value))}
              error={touched && fee === ''}
              fullWidth
            />

            <DatePicker label="Vencimento" value={maturity} onChange={(v) => setMaturity(v)} />
          </Stack>

          <Box mt={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleSubmit}
              disabled={loading || fetching}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              Criar ativo
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Snackbar
        open={snackOpen}
        autoHideDuration={5000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackOpen(false)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  )
}
