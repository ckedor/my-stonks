import { ASSET_ROUTES, MARKET_DATA_SERIES_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import AddIcon from '@mui/icons-material/Add'
import axios from 'axios'
import {
    AppButton,
    AppConfirmDialog,
    AppCrudForm,
    AppCrudTable,
    AppFilterBar,
    AppSearchField,
    AppSelect,
    AppSnackbar,
    AppStack,
    type ColumnConfig,
    type FieldConfig,
    PageTitle,
} from '@/components/ui'
import CrudPageSkeleton from '../CrudPageSkeleton'
import { FundRegistrationDrawer } from '@/components/fund-registry/FundRegistrationDrawer'
import AssetDescriptionDraftButton from './AssetDescriptionDraftButton'
import { FundRegistryPanel } from './FundRegistryPanel'
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

const ALL = 'all'

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback
  const message = error.response?.data?.message
  return typeof message === 'string' ? message : fallback
}

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<AssetRow | null>(null)
  const [fundRegistrationOpen, setFundRegistrationOpen] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', tone: 'success' as 'success' | 'danger' })

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

  const filteredAssets = useMemo(() => {
    const s = search.trim().toLowerCase()
    return assets.filter((a) => {
      if (classFilter !== ALL && String(a.asset_type?.asset_class_id) !== classFilter) return false
      if (typeFilter !== ALL && String(a.asset_type_id) !== typeFilter) return false
      if (s === '') return true
      return (
        a.ticker?.toLowerCase().includes(s) ||
        a.name.toLowerCase().includes(s) ||
        a.asset_type?.short_name.toLowerCase().includes(s)
      )
    })
  }, [search, classFilter, typeFilter, assets])

  const classOptions = useMemo(() => {
    const classes = new Map(assetTypes.map((t) => [t.asset_class.id, t.asset_class.name]))
    return [
      { value: ALL, label: 'Todas' },
      ...[...classes]
        .sort(([, a], [, b]) => a.localeCompare(b))
        .map(([id, name]) => ({ value: String(id), label: name })),
    ]
  }, [assetTypes])

  // O tipo depende da classe: escolhida uma classe, só os tipos dela aparecem.
  const typeOptions = useMemo(
    () => [
      { value: ALL, label: 'Todos' },
      ...assetTypes
        .filter((t) => classFilter === ALL || String(t.asset_class_id) === classFilter)
        .sort((a, b) => a.short_name.localeCompare(b.short_name))
        .map((t) => ({ value: String(t.id), label: `${t.short_name} — ${t.name}` })),
    ],
    [assetTypes, classFilter],
  )

  const handleClassFilterChange = (value: string) => {
    setClassFilter(value)
    setTypeFilter(ALL)
  }

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
      setAssetTypes(typesRes.data)
      setExchanges(exchangesRes.data)
      setFiiSegments(fiiSegRes.data)
      setEtfSegments(etfSegRes.data)
      setFixedIncomeTypes(fiTypesRes.data)
      setTreasuryBondTypes(tbTypesRes.data)
      setReferenceSeries(seriesRes.data)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      setSnackbar({ open: true, message: 'Erro ao carregar dados', tone: 'danger' })
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
        summary: detail.summary ?? '',
        description: detail.description ?? '',
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
        flat.anbima_category = detail.fund.anbima_category
        flat.fund_registry_class_id = detail.fund.fund_registry_class_id
        flat.fund_share_series_id = detail.fund.fund_share_series_id
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
      setSnackbar({ open: true, message: 'Erro ao carregar detalhes do ativo', tone: 'danger' })
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
      setSnackbar({ open: true, message: 'Ativo excluído com sucesso', tone: 'success' })
      fetchData()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      setSnackbar({
        open: true,
        message: getApiErrorMessage(error, 'Erro ao excluir ativo'),
        tone: 'danger',
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
        setSnackbar({ open: true, message: 'Ativo atualizado com sucesso', tone: 'success' })
      } else {
        await api.post(ASSET_ROUTES.create, data)
        setSnackbar({ open: true, message: 'Ativo criado com sucesso', tone: 'success' })
      }
      fetchData()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      setSnackbar({
        open: true,
        message: getApiErrorMessage(error, 'Erro ao salvar ativo'),
        tone: 'danger',
      })
      throw error
    }
  }

  const columns: ColumnConfig[] = [
    { field: 'id', label: 'ID' },
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

  const registryClassId = (selectedAsset?.fund_registry_class_id as number | null | undefined) ?? null
  const linkedFund = registryClassId !== null

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
        // Um fundo vinculado ao cadastro da CVM tem o CNPJ da classe; a categoria
        // digitada só vale quando o cadastro não traz classificação ANBIMA.
        return [
          { name: 'legal_id', label: 'CNPJ', type: 'text', disabled: linkedFund },
          { name: 'anbima_category', label: 'Categoria ANBIMA (se o cadastro não tiver)', type: 'text' },
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
    [fiiSegments, etfSegments, fixedIncomeTypes, treasuryBondTypes, referenceSeries, linkedFund],
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

  /* O texto de cadastro é do mantenedor, e o botão só propõe.
   *
   * Nada do que a IA escreve chega ao banco por conta própria: o rascunho cai
   * nos campos, quem edita e salva é quem está na tela. É por isso que não há
   * coluna dizendo de onde o texto veio — o que está gravado é sempre o que
   * alguém gravou. Só faz sentido com o ativo já existindo, porque o rascunho
   * é montado a partir do cadastro e das cotações dele. */
  const registryTextFields: FieldConfig[] = useMemo(
    () => [
      {
        name: 'summary',
        label: 'Resumo',
        type: 'text',
        helperText: 'Uma frase. É o que aparece numa linha de lista.',
        action: selectedAsset
          ? (setFieldValue) => (
              <AssetDescriptionDraftButton
                assetId={selectedAsset.id}
                onDraft={(draft) => {
                  setFieldValue('summary', draft.summary)
                  setFieldValue('description', draft.description)
                }}
              />
            )
          : undefined,
      },
      {
        name: 'description',
        label: 'Descrição',
        type: 'text',
        rows: 6,
        helperText: 'O texto da página do ativo.',
      },
    ],
    [selectedAsset],
  )

  const fields: FieldConfig[] = useMemo(
    () => [...baseFields, ...getSubclassFields(selectedTypeId), ...registryTextFields],
    [baseFields, getSubclassFields, selectedTypeId, registryTextFields],
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
          <AppStack direction="row" gap="sm">
            <AppButton emphasis="outline" icon={<AccountBalanceIcon />} onClick={() => setFundRegistrationOpen(true)}>
              Cadastrar fundo
            </AppButton>
            <AppButton icon={<AddIcon />} onClick={handleCreate}>
              Novo Ativo
            </AppButton>
          </AppStack>
        </AppStack>

        <AppStack gap="md">
          <AppFilterBar>
            <AppSearchField
              label="Buscar ativo"
              placeholder="Busque por ticker, nome ou tipo..."
              hideLabel
              icon
              size="bar"
              value={search}
              onChange={setSearch}
            />
            <AppSelect label="Classe" options={classOptions} value={classFilter} onChange={handleClassFilterChange} />
            <AppSelect label="Tipo" options={typeOptions} value={typeFilter} onChange={setTypeFilter} size="md" />
          </AppFilterBar>

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
      >
        {linkedFund && selectedAsset?.id && selectedTypeId !== null && FUND_TYPES.has(selectedTypeId) && (
          <FundRegistryPanel
            assetId={selectedAsset.id}
            classId={registryClassId}
            seriesId={(selectedAsset.fund_share_series_id as number | null | undefined) ?? null}
          />
        )}
      </AppCrudForm>

      <FundRegistrationDrawer
        open={fundRegistrationOpen}
        onClose={() => setFundRegistrationOpen(false)}
        onRegistered={(assetId) => {
          setSnackbar({ open: true, message: `Fundo cadastrado como ativo #${assetId}`, tone: 'success' })
          fetchData()
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
        tone={snackbar.tone}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </>
  )
}
