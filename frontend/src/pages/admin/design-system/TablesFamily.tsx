import {
  AppAssetLogo,
  AppButton,
  AppChip,
  AppCollapse,
  AppCrudTable,
  AppDataTable,
  AppHeatmapTable,
  AppListRow,
  AppLogoImage,
  AppPagination,
  AppSimpleTable,
  AppStack,
  AppText,
  useAppTheme,
  withOpacity,
  type AppSimpleTableColumn,
  type ColumnConfig,
} from '@/components/ui'
import { useState } from 'react'
import { Entry, State, States } from './Specimen'

interface Execution {
  id: number
  status: 'Sucesso' | 'Falha' | 'Na fila'
  detail: string
  rows: number
}

const EXECUTIONS: Execution[] = [
  { id: 7, status: 'Sucesso', detail: 'Um texto longo o bastante para a coluna clamped cortar com reticências', rows: 4310 },
  { id: 6, status: 'Falha', detail: 'timeout no provedor', rows: 0 },
  { id: 5, status: 'Na fila', detail: '—', rows: 0 },
]

const STATUS_TONE = { Sucesso: 'success', Falha: 'danger', 'Na fila': 'neutral' } as const

const COLUMNS: AppSimpleTableColumn<Execution>[] = [
  { label: 'ID', sortValue: (row) => row.id, render: (row) => `#${row.id}` },
  { label: 'Status', render: (row) => <AppChip label={row.status} tone={STATUS_TONE[row.status]} /> },
  { label: 'Detalhe', width: 'clamped', render: (row) => row.detail },
  {
    label: 'Linhas',
    align: 'right',
    hint: 'Linhas persistidas pela execução',
    sortValue: (row) => row.rows,
    render: (row) => row.rows.toLocaleString('pt-BR'),
  },
]

const MANY_EXECUTIONS: Execution[] = Array.from({ length: 23 }, (_, index) => ({
  id: 100 - index,
  status: index % 5 === 0 ? 'Falha' : 'Sucesso',
  detail: `Execução ${100 - index}`,
  rows: (index + 1) * 37,
}))

interface Broker {
  id: number
  name: string
  currency: string
}

const BROKERS: Broker[] = [
  { id: 1, name: 'XP Investimentos', currency: 'BRL' },
  { id: 2, name: 'Avenue', currency: 'USD' },
]

const BROKER_COLUMNS: ColumnConfig[] = [
  { field: 'id', label: 'ID' },
  { field: 'name', label: 'Nome' },
  { field: 'currency', label: 'Moeda' },
]

interface Quote {
  date: string
  close: number
}

const QUOTES: Quote[] = Array.from({ length: 12 }, (_, index) => {
  const day = new Date(Date.UTC(2026, 1, 1 + index))
  return { date: day.toISOString().slice(0, 10), close: 30 + Math.round(Math.sin(index / 3) * 300) / 100 }
})

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']
const RETURNS: Record<string, number[]> = {
  '2025': [1.2, -0.8, 2.4, 0.3, -1.9, 1.1],
  '2026': [0.6, 1.8, -2.6, 0.9, 1.4, -0.2],
}

function SelectableTable() {
  const [selected, setSelected] = useState(EXECUTIONS[0].id)
  return (
    <AppSimpleTable
      rows={EXECUTIONS}
      columns={COLUMNS}
      getRowKey={(row) => row.id}
      surface="outlined"
      onRowClick={(row) => setSelected(row.id)}
      isRowSelected={(row) => row.id === selected}
    />
  )
}

function ListRows() {
  const [selected, setSelected] = useState('PETR4')
  return (
    <AppStack>
      {['PETR4', 'HGLG11', 'BOVA11'].map((ticker) => (
        <AppListRow key={ticker} selected={ticker === selected} onClick={() => setSelected(ticker)}>
          <AppStack direction="row" gap="sm" align="center">
            <AppText variant="bodySmall" weight="strong">
              {ticker}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {ticker === selected ? 'selected' : 'onClick'}
            </AppText>
          </AppStack>
        </AppListRow>
      ))}
    </AppStack>
  )
}

function Pagination() {
  const [page, setPage] = useState(1)
  return <AppPagination count={8} page={page} onChange={setPage} />
}

function Collapse() {
  const [open, setOpen] = useState(false)
  return (
    <AppStack gap="sm">
      <AppButton emphasis="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
        {open ? 'Recolher' : 'Expandir'}
      </AppButton>
      <AppCollapse open={open}>
        <AppText variant="bodySmall" tone="secondary">
          O conteúdo que entra e sai sem empurrar a tela aos saltos.
        </AppText>
      </AppCollapse>
    </AppStack>
  )
}

export default function TablesFamily() {
  const theme = useAppTheme()
  const { success, error } = theme.palette

  const heatmapRows = Object.entries(RETURNS).map(([year, values]) => ({
    label: year,
    cells: values.map((value) => ({
      text: `${value > 0 ? '+' : ''}${value.toFixed(1)}%`,
      background: withOpacity(value >= 0 ? success.main : error.main, Math.min(Math.abs(value) / 3, 1) * 0.6),
    })),
  }))

  return (
    <AppStack gap="lg">
      <Entry
        name="AppSimpleTable"
        role="A tabela do design system, e a única que desenha linha de dado. A célula recebe render: a tabela não formata nada."
      >
        <AppStack gap="lg">
          <State label="surface=outlined · coluna clamped · hint no cabeçalho · ordenável">
            <AppSimpleTable rows={EXECUTIONS} columns={COLUMNS} getRowKey={(row) => row.id} surface="outlined" />
          </State>
          <State label="defaultSort=Linhas desc">
            <AppSimpleTable
              rows={EXECUTIONS}
              columns={COLUMNS}
              getRowKey={(row) => row.id}
              surface="outlined"
              defaultSort={{ column: 'Linhas', direction: 'desc' }}
            />
          </State>
          <State label="onRowClick · isRowSelected">
            <SelectableTable />
          </State>
          <State label="getRowSurface · linhas de naturezas diferentes">
            <AppSimpleTable
              rows={EXECUTIONS}
              columns={COLUMNS}
              getRowKey={(row) => row.id}
              surface="outlined"
              getRowSurface={(row) => (row.status === 'Falha' ? 'sunken' : 'paper')}
            />
          </State>
          <State label="pageSize=5 · pageSizeOptions">
            <AppSimpleTable
              rows={MANY_EXECUTIONS}
              columns={COLUMNS}
              getRowKey={(row) => row.id}
              surface="outlined"
              pageSize={5}
              pageSizeOptions={[5, 10, 25]}
            />
          </State>
          <State label="vazia · emptyMessage">
            <AppSimpleTable
              rows={[]}
              columns={COLUMNS}
              getRowKey={(row) => row.id}
              surface="outlined"
              emptyMessage="Nenhuma execução registrada."
            />
          </State>
        </AppStack>
      </Entry>

      <Entry
        name="AppCrudTable"
        role="O AppSimpleTable do CRUD do admin: colunas por field, como o AppCrudForm, e a coluna de ações no fim."
      >
        <AppCrudTable data={BROKERS} columns={BROKER_COLUMNS} onEdit={() => undefined} onDelete={() => undefined} />
      </Entry>

      <Entry
        name="AppDataTable"
        role="O AppSimpleTable de um histórico: do mais recente para o mais antigo, com busca por dia."
      >
        <AppStack gap="lg">
          <State label="com linhas">
            <AppDataTable
              rows={QUOTES}
              getDate={(row) => row.date}
              emptyMessage="Nenhuma cotação persistida."
              columns={[
                { label: 'Data', render: (row) => row.date.split('-').reverse().join('/') },
                { label: 'Fechamento', align: 'right', render: (row) => row.close.toFixed(2) },
              ]}
            />
          </State>
          <State label="vazio">
            <AppDataTable<Quote>
              rows={[]}
              getDate={(row) => row.date}
              emptyMessage="Nenhuma cotação persistida."
              columns={[{ label: 'Data', render: (row) => row.date }]}
            />
          </State>
        </AppStack>
      </Entry>

      <Entry
        name="AppHeatmapTable"
        role="A tabela em que a cor da célula é o dado e o número só confirma. As células se tocam para a mancha ser contínua."
      >
        <AppHeatmapTable rowHeader="Ano" columns={MONTHS} rows={heatmapRows} borderColor={theme.palette.divider} />
      </Entry>

      <Entry name="AppListRow" role="A linha de uma lista que não é tabela — um item por linha, clicável.">
        <ListRows />
      </Entry>

      <Entry
        name="AppAssetLogo + AppLogoImage"
        role="A marca de um ativo ao lado do nome. AppAssetLogo é o quadrado de tamanho fixo de uma linha; AppLogoImage, a imagem solta. Sem src, reserve guarda o espaço para a coluna não desalinhar."
      >
        <States>
          <State label="AppAssetLogo · src">
            <AppAssetLogo src="/favicon.svg" />
          </State>
          <State label="size=40">
            <AppAssetLogo src="/favicon.svg" size={40} />
          </State>
          <State label="sem src · reserve">
            <AppStack direction="row" gap="sm" align="center">
              <AppAssetLogo reserve />
              <AppText variant="bodySmall">TESOURO IPCA+</AppText>
            </AppStack>
          </State>
          <State label="AppLogoImage">
            <AppLogoImage src="/favicon.svg" alt="My Stonks" />
          </State>
        </States>
      </Entry>

      <Entry name="AppPagination" role="Páginas numeradas, para a lista paginada no servidor.">
        <Pagination />
      </Entry>

      <Entry name="AppCollapse" role="Mostra e esconde um bloco, animando a altura.">
        <Collapse />
      </Entry>
    </AppStack>
  )
}
