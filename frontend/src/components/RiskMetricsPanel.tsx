import { AssetAnalysis } from '@/types'
import { Box, Divider, Stack, Tooltip, Typography } from '@mui/material'

interface Props {
  analysis: AssetAnalysis
}

interface Metric {
  label: string
  value: string
  /** O que a métrica responde, em uma frase. Estes nomes são jargão: sem a
   *  explicação, metade do painel é decoração. */
  hint: string
  color?: string
}

/** As medidas de risco, agrupadas pela pergunta que respondem.
 *
 *  Antes era uma lista de `rótulo .......... valor` em duas colunas, que lê
 *  como planilha: oito números do mesmo tamanho, sem dizer qual responde o quê.
 *  Agrupados, cada bloco tem um assunto — o quanto oscila, o quanto se perde no
 *  pior caso, e como os retornos se distribuem. */
export default function RiskMetricsPanel({ analysis }: Props) {
  const { risk_metrics } = analysis

  const number = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const percent = (value: number) => `${number(value * 100)}%`

  const groups: { title: string; metrics: Metric[] }[] = [
    {
      title: 'Oscilação',
      metrics: [
        {
          label: 'Volatilidade anual',
          value: percent(risk_metrics.annualized_vol),
          hint: 'Desvio-padrão dos retornos, anualizado: o quanto o valor oscila em torno da própria média.',
        },
        {
          label: 'Semidesvio',
          value: percent(risk_metrics.semideviation),
          hint: 'Como a volatilidade, mas contando só os dias de queda — oscilar para cima não incomoda ninguém.',
        },
        {
          label: 'Sharpe',
          value: number(risk_metrics.sharpe_ratio),
          hint: 'Retorno acima do ativo livre de risco por unidade de volatilidade. Quanto maior, melhor pago é o risco corrido.',
          color: risk_metrics.sharpe_ratio > 0 ? 'success.main' : 'error.main',
        },
      ],
    },
    {
      title: 'Perdas',
      metrics: [
        {
          label: 'Max drawdown',
          value: percent(risk_metrics.drawdown.stats.max_drawdown),
          hint: 'A maior queda já sofrida entre um topo e o fundo seguinte.',
          color: 'error.main',
        },
        {
          label: 'VaR 95%',
          value: percent(risk_metrics.var_95),
          hint: 'Perda diária que só é superada em 5% dos dias.',
          color: 'warning.main',
        },
        {
          label: 'CVaR 95%',
          value: percent(risk_metrics.cvar_95),
          hint: 'Perda média nos 5% de dias piores — o tamanho do estrago quando ele passa do VaR.',
          color: 'warning.main',
        },
      ],
    },
    {
      title: 'Distribuição',
      metrics: [
        {
          label: 'Assimetria',
          value: number(risk_metrics.skewness),
          hint: 'Para que lado a distribuição pende. Negativa significa mais quedas extremas do que altas extremas.',
        },
        {
          label: 'Curtose',
          value: number(risk_metrics.kurtosis),
          hint: 'Peso das caudas: quanto maior, mais frequentes são os dias muito fora do normal.',
        },
      ],
    },
  ]

  return (
    // Cada grupo é uma coluna, separada por régua. Lado a lado em uma faixa só,
    // os oito números viravam uma fileira densa e os títulos dos grupos não
    // chegavam a agrupar nada.
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 3, sm: 4 }}
      divider={
        <Divider
          orientation="vertical"
          flexItem
          sx={{ display: { xs: 'none', sm: 'block' } }}
        />
      }
      alignItems="stretch"
    >
      {groups.map((group) => (
        <Box key={group.title} sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              mb: 1.5,
            }}
          >
            {group.title}
          </Typography>
          <Stack spacing={1.5}>
            {group.metrics.map((metric) => (
              <MetricRow key={metric.label} metric={metric} />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}

/** Rótulo à esquerda, valor à direita: dentro de uma coluna estreita os valores
 *  ficam alinhados entre si e a comparação vertical fica de graça. */
function MetricRow({ metric }: { metric: Metric }) {
  return (
    <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2}>
      <Tooltip title={metric.hint}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ cursor: 'help', textDecorationStyle: 'dotted' }}
        >
          {metric.label}
        </Typography>
      </Tooltip>
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: metric.color ?? 'text.primary', whiteSpace: 'nowrap' }}
      >
        {metric.value}
      </Typography>
    </Stack>
  )
}
