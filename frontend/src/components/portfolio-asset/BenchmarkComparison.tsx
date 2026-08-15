import { BenchmarkMetrics } from '@/types'
import { Box, Tooltip, Typography } from '@mui/material'

interface Props {
  metrics: Record<string, BenchmarkMetrics>
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
  const rows = Object.entries(metrics)
  if (!rows.length) return null

  const format = (key: keyof BenchmarkMetrics, value: number) => {
    if (key === 'beta' || key === 'correlation') return value.toFixed(2)
    return `${value >= 0 ? '+' : ''}${value.toFixed(2).replace('.', ',')}%`
  }

  const colorOf = (key: keyof BenchmarkMetrics, value: number) => {
    if (key !== 'alpha') return 'text.primary'
    return value >= 0 ? 'success.main' : 'error.main'
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `minmax(88px, 1fr) repeat(${COLUMNS.length}, minmax(84px, 1fr))`,
          columnGap: 2,
          rowGap: 1.25,
          minWidth: 420,
        }}
      >
        <Box />
        {COLUMNS.map((column) => (
          <Tooltip key={column.key} title={column.hint}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: 'right', cursor: 'help', justifySelf: 'end' }}
            >
              {column.label}
            </Typography>
          </Tooltip>
        ))}

        {rows.map(([name, benchmark]) => (
          <Box key={name} sx={{ display: 'contents' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {name}
            </Typography>
            {COLUMNS.map((column) => (
              <Typography
                key={column.key}
                variant="body2"
                sx={{
                  textAlign: 'right',
                  fontWeight: 600,
                  color: colorOf(column.key, benchmark[column.key]),
                }}
              >
                {format(column.key, benchmark[column.key])}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
