import {
  AppEmptyState,
  AppGrid,
  AppPageHeader,
  AppPageHeaderSkeleton,
  AppPagination,
  AppSearchField,
  AppSelect,
  AppSkeleton,
  AppStack,
  AppStackItem,
  AppText,
  AppToggleGroup,
} from '@/components/ui'
import { ASSET_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { useMarketStore } from '@/stores/market'
import { useTradeFormStore } from '@/stores/trade-form'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AssetCard from './AssetCard'
import AssetListView from './AssetListView'
import { useMarketQuotes } from './useMarketQuotes'

const VIEW_OPTIONS = [
  { value: 'card' as const, label: 'Cards', icon: <ViewModuleIcon fontSize="small" /> },
  { value: 'list' as const, label: 'Lista', icon: <ViewListIcon fontSize="small" /> },
]

/** Opção que desliga o filtro. Vazio é a ausência de recorte, e é o valor com
 *  que o estado nasce. */
const ALL = ''

const ITEMS_PER_PAGE = 24
/* A chave tem versão porque o padrão mudou: quem já visitou a tela tinha
   'card' gravado e continuaria vendo os cartões para sempre, sem nunca ver a
   lista que virou o padrão. Uma chave nova devolve a escolha ao padrão uma
   vez, e a partir daí ela volta a ser de quem usa. */
const VIEW_MODE_KEY = 'my-stonks:market:view-mode:v2'

/* A lista é o padrão, e não os cartões: o catálogo tem milhares de papéis e
   quem chega aqui está procurando um, não passeando. Os cartões continuam a um
   clique, para quando a navegação é de fato exploratória. */
const DEFAULT_VIEW_MODE: ViewMode = 'list'

type ViewMode = 'card' | 'list'

export default function MarketAtivosPage() {
  const navigate = useNavigate()
  const { openTradeForm } = useTradeFormStore()

  const { assets, assetTypes, loading: marketLoading } = useMarketStore()
  const [error, setError] = useState<string | null>(null)

  const loading = marketLoading && assets.length === 0

  // Filters
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<number | ''>('')
  const [selectedClass, setSelectedClass] = useState<number | ''>('')
  const [page, setPage] = useState(1)

  // Remembered so the browsing style survives a reload.
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null) ?? DEFAULT_VIEW_MODE,
  )
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    const fetchData = async () => {
      const { assets: cachedAssets, setAssets, setAssetTypes, setLoading } =
        useMarketStore.getState()
      const hasCachedAssets = cachedAssets.length > 0
      // Only show loading spinner if we have no cached data
      if (!hasCachedAssets) setLoading(true)
      setError(null)
      try {
        const [assetsRes, typesRes] = await Promise.all([
          api.get(ASSET_ROUTES.list),
          api.get(ASSET_ROUTES.type),
        ])
        setAssets(assetsRes.data)
        setAssetTypes(typesRes.data)
      } catch (err) {
        console.error('Erro ao carregar ativos', err)
        if (!hasCachedAssets) setError('Erro ao carregar ativos do mercado.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const assetClasses = useMemo(() => {
    const classMap = new Map<number, { id: number; name: string }>()
    assetTypes.forEach((type) => {
      if (type.asset_class && !classMap.has(type.asset_class.id)) {
        classMap.set(type.asset_class.id, type.asset_class)
      }
    })
    return Array.from(classMap.values())
  }, [assetTypes])

  const { byTicker: quotes } = useMarketQuotes()

  const quoteOf = useCallback(
    (asset: { ticker: string | null }) =>
      asset.ticker ? quotes.get(asset.ticker.toUpperCase()) : undefined,
    [quotes],
  )

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesTicker = asset.ticker?.toLowerCase().includes(searchLower)
        const matchesName = asset.name?.toLowerCase().includes(searchLower)
        if (!matchesTicker && !matchesName) return false
      }

      if (selectedType && asset.asset_type_id !== selectedType) return false

      if (selectedClass && asset.asset_type?.asset_class_id !== selectedClass) return false

      return true
    })
  }, [assets, search, selectedType, selectedClass])

  /* Ordem por liquidez, e não alfabética.
   *
   * A ordem do dicionário abria a tela em BDRs de três letras e um número, que
   * é o começo do alfabeto e o fim da relevância. O volume negociado é a única
   * medida de "o que o mercado está olhando" que o catálogo já traz; o que não
   * tem cotação — renda fixa, tesouro — vai para o fim, em ordem de nome, onde
   * continua encontrável pela busca. */
  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      const volumeA = quoteOf(a)?.volume ?? null
      const volumeB = quoteOf(b)?.volume ?? null
      if (volumeA == null && volumeB == null) return a.name.localeCompare(b.name)
      if (volumeA == null) return 1
      if (volumeB == null) return -1
      return volumeB - volumeA
    })
  }, [filteredAssets, quoteOf])

  const totalPages = Math.ceil(sortedAssets.length / ITEMS_PER_PAGE)
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return sortedAssets.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedAssets, page])

  useEffect(() => {
    setPage(1)
  }, [search, selectedType, selectedClass])

  const filteredTypes = useMemo(() => {
    if (!selectedClass) return assetTypes
    return assetTypes.filter((t) => t.asset_class_id === selectedClass)
  }, [assetTypes, selectedClass])

  if (loading) {
    return (
      <AppStack gap="lg">
        <AppPageHeaderSkeleton titleWidth={120} actions={4} />
        <AppSkeleton height={140} />
        <AppGrid cols={{ xs: 1, sm: 2, md: 3, lg: 4 }} gap="md">
          {Array.from({ length: 12 }).map((_, index) => (
            <AppSkeleton key={index} height={180} />
          ))}
        </AppGrid>
      </AppStack>
    )
  }

  if (error) {
    return <AppText tone="danger">{error}</AppText>
  }

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Ativos"
        breadcrumbs={[
          { label: 'Mercado', href: '/market/overview' },
          { label: 'Ativos' },
        ]}
        actions={
          <>
            <AppStackItem minWidth={280}>
            <AppSearchField
              label="Buscar ativo"
              hideLabel
              icon
              placeholder="Buscar por ticker ou nome..."
              value={search}
              onChange={setSearch}
            />
          </AppStackItem>

          <AppSelect
            label="Classe"
            options={[
              { value: ALL, label: 'Todas' },
              ...assetClasses.map((cls) => ({ value: String(cls.id), label: cls.name })),
            ]}
            value={String(selectedClass)}
            onChange={(value) => {
              setSelectedClass(value === ALL ? ALL : Number(value))
              setSelectedType(ALL)
            }}
          />

          <AppSelect
            label="Tipo"
            options={[
              { value: ALL, label: 'Todos' },
              ...filteredTypes.map((type) => ({ value: String(type.id), label: type.short_name })),
            ]}
            value={String(selectedType)}
            onChange={(value) => setSelectedType(value === ALL ? ALL : Number(value))}
          />

          <AppToggleGroup
            label="Modo de exibição"
            options={VIEW_OPTIONS}
            value={viewMode}
            onChange={setViewMode}
          />
          </>
        }
      />

      {viewMode === 'card' ? (
        <AppGrid cols={{ xs: 1, sm: 2, md: 3, lg: 4 }} gap="md">
          {paginatedAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              quote={quoteOf(asset)}
              onOpen={() => navigate(`/market/asset/${asset.id}`)}
              onBuy={() =>
                openTradeForm({
                  id: asset.id,
                  ticker: asset.ticker,
                  name: asset.name,
                  asset_type_id: asset.asset_type_id,
                })
              }
            />
          ))}
        </AppGrid>
      ) : (
        <AssetListView
          assets={sortedAssets}
          pageSize={ITEMS_PER_PAGE}
          quoteOf={quoteOf}
          onOpen={(asset) => navigate(`/market/asset/${asset.id}`)}
          onBuy={(asset) =>
            openTradeForm({
              id: asset.id,
              // Assets without a ticker (fixed income) are still tradable.
              ticker: asset.ticker ?? '',
              name: asset.name,
              asset_type_id: asset.asset_type_id,
            })
          }
        />
      )}

      {viewMode === 'card' && totalPages > 1 && (
        <AppStack direction="row" justify="center" align="center" gap="md">
          <AppText variant="bodySmall" tone="secondary">
            {filteredAssets.length} ativos
          </AppText>
          <AppPagination count={totalPages} page={page} onChange={setPage} />
        </AppStack>
      )}

      {filteredAssets.length === 0 && (
        <AppEmptyState
          size="section"
          title="Nenhum ativo encontrado"
          description="Tente ajustar os filtros de busca"
        />
      )}
    </AppStack>
  )
}
