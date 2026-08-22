import { AppSimpleTable, AppText, type AppSimpleTableColumn } from '@/components/ui'
import { BenchmarkMetrics } from '@/types'

interface Props {
  metrics: Record<string, BenchmarkMetrics>
}

interface BenchmarkRow extends BenchmarkMetrics {
  name: string
}

const COLUMNS: { key: keyof BenchmarkMetrics; label: string; hint: string }[] = [
  {
    key: 'cagr',
    label: 'CAGR',
    hint: 'Quanto o benchmark rendeu ao ano no mesmo período da posição.',
  },
  {
    key: 'alpha',
    label: 'Alfa',
    hint: 'Quanto a posição rendeu ao ano acima do benchmark. É a diferença entre os dois CAGRs.',
  },
  {
    key: 'beta',
    label: 'Beta',
    hint: 'O quanto a posição se move quando o benchmark se move. Acima de 1, amplifica; abaixo, amortece.',
  },
  {
    key: 'correlation',
    label: 'Correlação',
    hint: 'O quanto os dois andam juntos, de -1 a 1. Perto de zero, o benchmark explica pouco do que acontece aqui.',
  },
]

/** Como a posição se saiu contra cada benchmark da carteira.
 *
 *  Uma linha por benchmark, e não um bloco por benchmark: a pergunta que se faz
 *  aqui é comparativa — bate mais o CDI ou o S&P500? — e colunas alinhadas
 *  respondem isso de relance, enquanto blocos empilhados obrigam a procurar o
 *  mesmo número em dois lugares.
 *
 *  Fica ao lado do gráfico, e não na aba de Risco: alfa e beta respondem "como
 *  isso se compara ao mercado", que é a mesma pergunta do gráfico logo acima —
 *  ali eles aprofundam o "X% acima do CDI" que a barra do gráfico resume. */
export default function BenchmarkComparison({ metrics }: Props) {
  const rows: BenchmarkRow[] = Object.entries(metrics).map(([name, values]) => ({
    name,
    ...values,
  }))
  if (!rows.length) return null

  const format = (key: keyof BenchmarkMetrics, value: number) => {
    if (key === 'beta' || key === 'correlation') return value.toFixed(2)
    return `${value >= 0 ? '+' : ''}${value.toFixed(2).replace('.', ',')}%`
  }

  // Só o alfa se lê pelo sinal: ele é o que a posição fez *acima* do
  // benchmark. Um beta negativo é uma informação, não uma má notícia.
  const toneOf = (key: keyof BenchmarkMetrics, value: number) =>
    key !== 'alpha' ? 'default' : value >= 0 ? 'success' : 'danger'

  const columns: AppSimpleTableColumn<BenchmarkRow>[] = [
    {
      label: 'Benchmark',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" inline>
          {row.name}
        </AppText>
      ),
    },
    ...COLUMNS.map<AppSimpleTableColumn<BenchmarkRow>>((column) => ({
      label: column.label,
      hint: column.hint,
      align: 'right',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" tone={toneOf(column.key, row[column.key])} inline>
          {format(column.key, row[column.key])}
        </AppText>
      ),
    })),
  ]

  return <AppSimpleTable rows={rows} columns={columns} getRowKey={(row) => row.name} />
}
