import { assetKeys, assetQueryOptions, useAssets, useAssetTypes } from '@/queries/assets'
import { ASSET_TYPES } from '@/constants/assetTypes'
import { Asset } from '@/types'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import { AppAutocomplete, AppGrid, AppGridItem, AppSelect } from '@/components/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import FixedIncomeForm from './FixedIncomeForm'
import { FundRegistrationDrawer } from './fund-registry/FundRegistrationDrawer'

interface AssetSelectorProps {
  value: number | null
  onChange: (asset: Asset | null) => void
  initialAsset?: { id: number; ticker: string; name: string; asset_type_id: number } | null
}

export default function AssetSelector({ value, onChange, initialAsset }: AssetSelectorProps) {
  const queryClient = useQueryClient()
  const { assetTypes, loading: typesLoading } = useAssetTypes()
  const { assets, loading: assetsLoading } = useAssets()
  const [selectedType, setSelectedType] = useState<number | ''>(initialAsset?.asset_type_id ?? '')
  const loading = typesLoading || assetsLoading
  const [createOpen, setCreateOpen] = useState(false)
  const [fundSearch, setFundSearch] = useState<string | null>(null)
  const isFund = selectedType === ASSET_TYPES.FI || selectedType === ASSET_TYPES.PREV

  // Quando initialAsset muda, define o tipo
  useEffect(() => {
    if (initialAsset?.asset_type_id) {
      setSelectedType(initialAsset.asset_type_id)
    } else {
      setSelectedType('')
    }
  }, [initialAsset])

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
      await queryClient.invalidateQueries({ queryKey: assetKeys.all })
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
            onChange={(next) => {
              setSelectedType(Number(next))
              onChange(null)
            }}
          />
        </AppGridItem>

        <AppGridItem span={8}>
          <AppAutocomplete
            label="Ativo"
            placeholder={isFund ? 'Nome do fundo ou CNPJ' : 'Selecione o ativo'}
            size="full"
            options={filteredAssets}
            value={selectedAsset}
            onChange={(asset) => onChange(asset)}
            getOptionLabel={(option) => option.ticker || option.name}
            filterOptions={(options, { inputValue }) => {
              const search = inputValue.toLocaleLowerCase()
              return options.filter((option) =>
                `${option.ticker ?? ''} ${option.name}`.toLocaleLowerCase().includes(search),
              )
            }}
            isOptionEqualToValue={(option, current) => option.id === current.id}
            disabled={!selectedType || loading}
            busy={loading}
            action={
              isFund
                ? {
                    label: 'Buscar fundo por CNPJ…',
                    icon: <AddCircleOutlineIcon fontSize="small" />,
                    onSelect: setFundSearch,
                  }
                : isFixedIncomeType
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
      {fundSearch !== null && (
        <FundRegistrationDrawer
          open
          initialQuery={fundSearch}
          initialAssetType={String(selectedType)}
          onClose={() => setFundSearch(null)}
          onRegistered={async (assetId) => {
            const asset = await queryClient.fetchQuery(assetQueryOptions(assetId))
            setSelectedType(asset.asset_type_id)
            onChange(asset)
          }}
        />
      )}
    </>
  )
}
