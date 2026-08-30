import { ASSET_ROUTES, MARKET_DATA_SERIES_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import AddIcon from '@mui/icons-material/Add'
import axios from 'axios'
import {
    AppButton,
    AppConfirmDialog,
    AppCrudForm,
    AppCrudTable,
    AppSearchField,
    AppSnackbar,
    AppStack,
    type ColumnConfig,
    type FieldConfig,
    PageTitle,
} from '@/components/ui'
import AssetCatalogueSync from './AssetCatalogueSync'
import CrudPageSkeleton from '../CrudPageSkeleton'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface AssetType {
  id: number
  short_name: string
  name: string
  asset_class_id: number
  asset_class: { id: number; name: string }
}

interface Exchange {
  id: number
  code: string
  name: string
}

interface Segment {
  id: number
  name: string
}

interface FixedIncomeType {
  id: number
  name: string
  description?: string
}

interface TreasuryBondType {
  id: number
  code: string
  name: string
}

/* A série de referência de uma renda fixa — o CDI de um CDB a 110% do CDI.
   O campo continua `index_id` porque é o nome do backend, mas a lista vem de
   `/market_data/series`: "index" deixou de ser uma rota própria, e chamar uma
   série de índice é justamente o que `docs/domain.md` proíbe. */
interface SeriesOption {
  id: number
  name: string
  short_name?: string
}

interface AssetRow {
  id: number
  ticker: string | null
  name: string
  asset_type_id: number
  asset_type: AssetType
  [key: string]: unknown
}

// Asset type ID constants matching backend
const STOCK_TYPES = new Set([4, 5]) // STOCK, BDR
const FII_TYPES = new Set([2]) // FII
const ETF_TYPES = new Set([1, 12]) // ETF, REIT
const FIXED_INCOME_TYPES = new Set([8, 9, 10, 11, 14]) // CDB, DEB, CRI, CRA, LCA
const FUND_TYPES = new Set([7, 6]) // FI, PREV
const TREASURY_TYPES = new Set([3]) // TREASURY

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback
  const message = error.response?.data?.message
  return typeof message === 'string' ? message : fallback
}

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [filteredAssets, setFilteredAssets] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<AssetRow | null>(null)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })

  // Reference data
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [fiiSegments, setFiiSegments] = useState<Segment[]>([])
  const [etfSegments, setEtfSegments] = useState<Segment[]>([])
  const [fixedIncomeTypes, setFixedIncomeTypes] = useState<FixedIncomeType[]>([])
  const [treasuryBondTypes, setTreasuryBondTypes] = useState<TreasuryBondType[]>([])
  const [referenceSeries, setReferenceSeries] = useState<SeriesOption[]>([])

  // Track selected asset_type_id for dynamic form fields
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredAssets(assets)
    } else {
      const s = search.toLowerCase()
      setFilteredAssets(
        assets.filter(
          (a) =>
            a.ticker?.toLowerCase().includes(s) ||
            a.name.toLowerCase().includes(s) ||
            a.asset_type?.short_name.toLowerCase().includes(s),
        ),
      )
    }
  }, [search, assets])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [assetsRes, typesRes, exchangesRes, fiiSegRes, etfSegRes, fiTypesRes, tbTypesRes, seriesRes] =
        await Promise.all([
          api.get(ASSET_ROUTES.list),
          api.get(ASSET_ROUTES.type),
          api.get(ASSET_ROUTES.exchange),
          api.get(ASSET_ROUTES.fiiSegment),
          api.get(ASSET_ROUTES.etfSegment),
          api.get(ASSET_ROUTES.fixedIncomeType),
          api.get(ASSET_ROUTES.treasuryBondType),
          api.get(MARKET_DATA_SERIES_ROUTES.options),
        ])
      setAssets(assetsRes.data)
      setFilteredAssets(assetsRes.data)
      setAssetTypes(typesRes.data)
      setExchanges(exchangesRes.data)
      setFiiSegments(fiiSegRes.data)
      setEtfSegments(etfSegRes.data)
      setFixedIncomeTypes(fiTypesRes.data)
      setTreasuryBondTypes(tbTypesRes.data)
      setReferenceSeries(seriesRes.data)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      setSnackbar({ open: true, message: 'Erro ao carregar dados', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedAsset(null)
    setSelectedTypeId(null)
    setFormOpen(true)
  }

  const handleEdit = async (asset: AssetRow) => {
    try {
      const res = await api.get(ASSET_ROUTES.byId(asset.id))
      const detail = res.data
      // Flatten subclass fields for the form
      const flat: Record<string, unknown> = {
        id: detail.id,
        ticker: detail.ticker,
        name: detail.name,
        asset_type_id: detail.asset_type_id,
        exchange_id: detail.exchange_id,
      }
      if (detail.stock) {
        flat.country = detail.stock.country
        flat.sector = detail.stock.sector
        flat.industry = detail.stock.industry
      }
      if (detail.fii) {
        flat.fii_segment_id = detail.fii.segment_id
      }
      if (detail.etf) {
        flat.etf_segment_id = detail.etf.segment_id
      }
      if (detail.fixed_income) {
        flat.maturity_date = detail.fixed_income.maturity_date
        flat.fee = detail.fixed_income.fee
        flat.index_id = detail.fixed_income.index_id
        flat.fixed_income_type_id = detail.fixed_income.fixed_income_type_id
      }
      if (detail.fund) {
        flat.legal_id = detail.fund.legal_id
        flat.anbima_code = detail.fund.anbima_code
        flat.anbima_code_class = detail.fund.anbima_code_class
        flat.anbima_category = detail.fund.anbima_category
      }
      if (detail.treasury_bond) {
        flat.treasury_bond_type_id = detail.treasury_bond.type_id
        flat.maturity_date = detail.treasury_bond.maturity_date
        flat.fee = detail.treasury_bond.fee
      }
      setSelectedAsset(flat as unknown as AssetRow)
      setSelectedTypeId(detail.asset_type_id)
      setFormOpen(true)
    } catch (error) {
      console.error('Erro ao carregar ativo:', error)
      setSnackbar({ open: true, message: 'Erro ao carregar detalhes do ativo', severity: 'error' })
    }
  }

  const handleDelete = (asset: AssetRow) => {
    setSelectedAsset(asset)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedAsset) return
    try {
      await api.delete(ASSET_ROUTES.byId(selectedAsset.id))
      setSnackbar({ open: true, message: 'Ativo excluído com sucesso', severity: 'success' })
      fetchData()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      setSnackbar({
        open: true,
        message: getApiErrorMessage(error, 'Erro ao excluir ativo'),
        severity: 'error',
      })
    } finally {
      setDeleteDialogOpen(false)
      setSelectedAsset(null)
    }
  }

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      if (selectedAsset && selectedAsset.id) {
        await api.put(ASSET_ROUTES.byId(selectedAsset.id), data)
        setSnackbar({ open: true, message: 'Ativo atualizado com sucesso', severity: 'success' })
      } else {
        await api.post(ASSET_ROUTES.create, data)
        setSnackbar({ open: true, message: 'Ativo criado com sucesso', severity: 'success' })
      }
      fetchData()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      setSnackbar({
        open: true,
        message: getApiErrorMessage(error, 'Erro ao salvar ativo'),
        severity: 'error',
      })
      throw error
    }
  }

  const columns: ColumnConfig[] = [
    { field: 'id', label: 'ID', align: 'center' },
    { field: 'ticker', label: 'Ticker', format: (v) => v || '—' },
    { field: 'name', label: 'Nome' },
    {
      field: 'asset_type',
      label: 'Tipo',
      format: (v) => v?.short_name || '—',
    },
    {
      field: 'asset_type',
      label: 'Classe',
      format: (v) => v?.asset_class?.name || '—',
    },
  ]

  const getSubclassFields = useCallback(
    (typeId: number | null): FieldConfig[] => {
      if (!typeId) return []

      if (STOCK_TYPES.has(typeId)) {
        return [
          { name: 'country', label: 'País', type: 'text' },
          { name: 'sector', label: 'Setor', type: 'text' },
          { name: 'industry', label: 'Indústria', type: 'text' },
        ]
      }
      if (FII_TYPES.has(typeId)) {
        return [
          {
            name: 'fii_segment_id',
            label: 'Segmento FII',
            type: 'select',
            options: fiiSegments.map((s) => ({ value: s.id, label: s.name })),
          },
        ]
      }
      if (ETF_TYPES.has(typeId)) {
        return [
          {
            name: 'etf_segment_id',
            label: 'Segmento ETF',
            type: 'select',
            options: etfSegments.map((s) => ({ value: s.id, label: s.name })),
          },
        ]
      }
      if (FIXED_INCOME_TYPES.has(typeId)) {
        return [
          {
            name: 'fixed_income_type_id',
            label: 'Tipo Renda Fixa',
            type: 'select',
            options: fixedIncomeTypes.map((t) => ({ value: t.id, label: t.name })),
          },
          { name: 'maturity_date', label: 'Vencimento', type: 'text' },
          { name: 'fee', label: 'Taxa (%)', type: 'number' },
          {
            name: 'index_id',
            label: 'Índice',
            type: 'select',
            options: referenceSeries.map((s) => ({ value: s.id, label: s.short_name || s.name })),
          },
        ]
      }
      if (FUND_TYPES.has(typeId)) {
        return [
          { name: 'legal_id', label: 'CNPJ', type: 'text' },
          { name: 'anbima_code', label: 'Código ANBIMA', type: 'text' },
          { name: 'anbima_code_class', label: 'Classe ANBIMA', type: 'text' },
          { name: 'anbima_category', label: 'Categoria ANBIMA', type: 'text' },
        ]
      }
      if (TREASURY_TYPES.has(typeId)) {
        return [
          {
            name: 'treasury_bond_type_id',
            label: 'Tipo Tesouro',
            type: 'select',
            required: true,
            options: treasuryBondTypes.map((t) => ({ value: t.id, label: t.name })),
          },
          { name: 'maturity_date', label: 'Vencimento', type: 'text' },
          { name: 'fee', label: 'Taxa (%)', type: 'number' },
        ]
      }
      return []
    },
    [fiiSegments, etfSegments, fixedIncomeTypes, treasuryBondTypes, referenceSeries],
  )

  const baseFields: FieldConfig[] = useMemo(
    () => [
      { name: 'ticker', label: 'Ticker', type: 'text' },
      { name: 'name', label: 'Nome', type: 'text', required: true },
      {
        name: 'asset_type_id',
        label: 'Tipo',
        type: 'select',
        required: true,
        options: assetTypes.map((t) => ({ value: t.id, label: `${t.short_name} — ${t.name}` })),
      },
      {
        name: 'exchange_id',
        label: 'Bolsa',
        type: 'select',
        options: [{ value: '', label: '— Nenhuma —' }, ...exchanges.map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }))],
      },
    ],
    [assetTypes, exchanges],
  )

  const fields: FieldConfig[] = useMemo(
    () => [...baseFields, ...getSubclassFields(selectedTypeId)],
    [baseFields, getSubclassFields, selectedTypeId],
  )

  // Watch when form opens with existing asset to set the type
  const handleFormClose = () => {
    setFormOpen(false)
    setSelectedTypeId(null)
  }

  if (loading) return <CrudPageSkeleton columns={columns.length + 1} />

  return (
    <>
      <AppStack gap="lg">
        <AppStack direction="row" justify="between" align="center">
          <PageTitle>Gerenciamento de Ativos</PageTitle>
          <AppButton icon={<AddIcon />} onClick={handleCreate}>
            Novo Ativo
          </AppButton>
        </AppStack>

        <AssetCatalogueSync
          onApplied={(report) => {
            void fetchData()
            setSnackbar({
              open: true,
              message: `Catálogo aplicado: ${report.created.length} cadastrados, ${report.updated.length} corrigidos`,
              severity: 'success',
            })
          }}
          onError={(message) => setSnackbar({ open: true, message, severity: 'error' })}
        />

        <AppStack gap="md">
          <AppSearchField
            value={search}
            onChange={setSearch}
            placeholder="Busque por ticker, nome ou tipo..."
          />

          <AppCrudTable data={filteredAssets} columns={columns} onEdit={handleEdit} onDelete={handleDelete} />
        </AppStack>
      </AppStack>

      <AppCrudForm
        open={formOpen}
        onClose={handleFormClose}
        onSave={handleSave}
        title={selectedAsset?.id ? 'Editar Ativo' : 'Novo Ativo'}
        fields={fields}
        initialData={selectedAsset}
        isEdit={!!selectedAsset?.id}
        onFieldChange={(name, value) => {
          if (name === 'asset_type_id') {
            setSelectedTypeId(value as number)
          }
        }}
      />

      <AppConfirmDialog
        open={deleteDialogOpen}
        title="Confirmar Exclusão"
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      >
        Tem certeza que deseja excluir o ativo <strong>{selectedAsset?.ticker || selectedAsset?.name}</strong>? Esta
        ação não pode ser desfeita. Ativos com histórico de carteira não são excluídos; nesses casos, altere o
        ticker mantendo o mesmo ativo.
      </AppConfirmDialog>

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </>
  )
}
