import {
  AppDateField,
  AppSearchField,
  AppSelect,
  AppToggleGroup,
} from '@/components/ui'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import type { Dayjs } from 'dayjs'
import type { AssetGroupBy, AssetListView } from './view-state'

/* Os filtros da listagem de ativos, no cabeçalho da página.
 *
 * Ficavam dentro da própria listagem, numa faixa de filtros que só esta tela
 * tinha — era metade do motivo de a tela de Ativos não parecer do mesmo app
 * que as outras. Agora são as `actions` do `AppPageHeader`, o mesmo lugar
 * onde Categorias põe o seletor de categoria e Distribuição o de métrica. */

const GROUP_BY_OPTIONS = [
  { value: 'category', label: 'Categoria Usuário' },
  { value: 'asset', label: 'Ativo' },
  { value: 'type', label: 'Produto' },
  { value: 'class', label: 'Classe' },
  { value: 'broker', label: 'Corretora' },
]

const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'Lista', icon: <ViewListIcon fontSize="small" /> },
  { value: 'card' as const, label: 'Cards', icon: <GridViewIcon fontSize="small" /> },
]

export interface AssetListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  groupBy: AssetGroupBy
  onGroupByChange: (value: AssetGroupBy) => void
  date: Dayjs | null
  onDateChange: (value: Dayjs | null) => void
  view: AssetListView
  onViewChange: (value: AssetListView) => void
}

export default function AssetListToolbar({
  search,
  onSearchChange,
  groupBy,
  onGroupByChange,
  date,
  onDateChange,
  view,
  onViewChange,
}: AssetListToolbarProps) {
  return (
    <>
      <AppSearchField label="Buscar Ativo" size="bar" value={search} onChange={onSearchChange} />
      <AppSelect
        label="Agrupar"
        options={GROUP_BY_OPTIONS}
        value={groupBy}
        onChange={(value) => onGroupByChange(value as AssetGroupBy)}
        density="comfortable"
      />
      <AppDateField label="Data" value={date} onChange={onDateChange} />
      <AppToggleGroup
        label="Modo de exibição"
        options={VIEW_OPTIONS}
        value={view}
        onChange={onViewChange}
      />
    </>
  )
}
