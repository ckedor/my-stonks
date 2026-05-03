
import { ASSET_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { Asset } from '@/types'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import {
    CircularProgress,
    FormControl,
    Grid,
    InputLabel,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Select,
    TextField,
} from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import { useCallback, useEffect, useMemo, useState } from 'react'
import FixedIncomeForm from './FixedIncomeForm'

interface AssetType {
  id: number
  short_name: string
  asset_class_id?: number
}

interface AssetSelectorProps {
  value: number | null
  onChange: (asset: Asset | null) => void
  initialAsset?: { id: number; ticker: string; name: string; asset_type_id: number } | null
}

const CREATE_SENTINEL_ID = -1
type AssetLike = Asset & { __create__?: boolean }

export default function AssetSelector({ value, onChange, initialAsset }: AssetSelectorProps) {
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedType, setSelectedType] = useState<number | ''>(initialAsset?.asset_type_id ?? '')
  const [loading, setLoading] = useState(true)
  const [popupOpen, setPopupOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  // Quando initialAsset muda, define o tipo
  useEffect(() => {
    if (initialAsset?.asset_type_id) {
      setSelectedType(initialAsset.asset_type_id)
    } else {
      setSelectedType('')
    }
  }, [initialAsset])

  const fetchTypes = useCallback(async () => {
    const res = await api.get(ASSET_ROUTES.type)
    setAssetTypes(res.data)
  }, [])

  const fetchAssets = useCallback(async () => {
    const res = await api.get(ASSET_ROUTES.list)
    setAssets(res.data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchTypes(), fetchAssets()])
      } catch {
        console.log('Failed to load asset types or assets')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchTypes, fetchAssets])

  const isFixedIncomeType = useMemo(() => {
    if (!selectedType) return false
    const t = assetTypes.find((t) => t.id === selectedType)
    return t?.asset_class_id === 1
  }, [assetTypes, selectedType])

  const filteredAssets = useMemo<AssetLike[]>(() => {
    if (!selectedType) return []
    const base = assets.filter((a) => a.asset_type_id === selectedType)
    return isFixedIncomeType
      ? [...base, { id: CREATE_SENTINEL_ID, ticker: 'Novo ativo…', __create__: true } as any]
      : base
  }, [assets, selectedType, isFixedIncomeType])

  const selectedAsset = useMemo(() => {
    const found = filteredAssets.find((a) => a.id === value)
    if (found) return found
    // Se não encontrou na lista filtrada mas temos initialAsset, usa ele
    if (initialAsset && initialAsset.id === value) {
      return initialAsset as Asset
    }
    return null
  }, [filteredAssets, value, initialAsset])

  const refetchAssets = async (created?: Asset) => {
    setCreateOpen(false)
    if (created) {
      await fetchAssets()
      onChange(created)
      setPopupOpen(false)
    }
  }

  return (
    <>
      <Grid container direction="row" spacing={2} alignItems="center">
        <Grid size={{ xs: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Tipo de Ativo</InputLabel>
            <Select
              value={selectedType}
              label="Tipo de Ativo"
              onChange={(e) => setSelectedType(Number(e.target.value))}
            >
              {assetTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.short_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 8 }}>
          <Autocomplete
            open={popupOpen}
            onOpen={() => setPopupOpen(true)}
            onClose={() => setPopupOpen(false)}
            options={filteredAssets}
            getOptionLabel={(option) =>
              (option as AssetLike).__create__ ? '' : `${(option as Asset).ticker}`
            }
            value={selectedAsset}
            isOptionEqualToValue={(option, val) => option.id === val.id}
            onChange={(_, newValue) => {
              if ((newValue as AssetLike | null)?.__create__) return
              onChange((newValue as Asset) ?? null)
            }}
            disabled={!selectedType || loading}
            renderOption={(props, option) => {
              const opt = option as AssetLike
              if (opt.__create__) {
                return (
                  <li
                    {...props}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPopupOpen(false)
                      setCreateOpen(true)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <ListItemIcon>
                      <AddCircleOutlineIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Novo ativo de renda fixa…" />
                  </li>
                )
              }
              return <li {...props}>{(option as Asset).ticker}</li>
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Ativo"
                placeholder="Selecione o ativo"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>
      </Grid>

      <FixedIncomeForm
        open={createOpen}
        assetTypeId={Number(selectedType)}
        onClose={refetchAssets}
      />
    </>
  )
}
