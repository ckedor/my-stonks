import { ASSET_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { Asset } from '@/types'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import { AppAutocomplete, AppGrid, AppGridItem, AppSelect } from '@/components/ui'
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

export default function AssetSelector({ value, onChange, initialAsset }: AssetSelectorProps) {
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedType, setSelectedType] = useState<number | ''>(initialAsset?.asset_type_id ?? '')
  const [loading, setLoading] = useState(true)
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

  const filteredAssets = useMemo<Asset[]>(() => {
    if (!selectedType) return []
    return assets.filter((a) => a.asset_type_id === selectedType)
  }, [assets, selectedType])

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
    }
  }

  return (
    <>
      <AppGrid cols={12} gap="md" align="center">
        <AppGridItem span={4}>
          <AppSelect
            label="Tipo de Ativo"
            size="full"
            density="comfortable"
            options={assetTypes.map((type) => ({ value: String(type.id), label: type.short_name }))}
            value={selectedType === '' ? '' : String(selectedType)}
            onChange={(next) => setSelectedType(Number(next))}
          />
        </AppGridItem>

        <AppGridItem span={8}>
          <AppAutocomplete
            label="Ativo"
            placeholder="Selecione o ativo"
            size="full"
            options={filteredAssets}
            value={selectedAsset}
            onChange={(asset) => onChange(asset)}
            getOptionLabel={(option) => option.ticker}
            isOptionEqualToValue={(option, current) => option.id === current.id}
            disabled={!selectedType || loading}
            busy={loading}
            /* O atalho de criar só existe em renda fixa: é a única classe em
               que o ativo pode não estar no cadastro ainda. */
            action={
              isFixedIncomeType
                ? {
                    label: 'Novo ativo de renda fixa…',
                    icon: <AddCircleOutlineIcon fontSize="small" />,
                    onSelect: () => setCreateOpen(true),
                  }
                : undefined
            }
          />
        </AppGridItem>
      </AppGrid>

      <FixedIncomeForm
        open={createOpen}
        assetTypeId={Number(selectedType)}
        onClose={refetchAssets}
      />
    </>
  )
}
