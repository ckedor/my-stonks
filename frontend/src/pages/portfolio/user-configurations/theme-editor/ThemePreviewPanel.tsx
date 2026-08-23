import {
  AppCard,
  AppChartArea,
  AppChip,
  AppGrid,
  AppStack,
  AppText,
  AppThemeScope,
  SectionTitle,
} from '@/components/ui'
import type { ThemePaletteConfig } from '@/theme/themes'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/* O tema sendo editado, aplicado a uma tela de mentira.
 *
 * Os componentes aqui dentro são os do app de verdade: dentro do
 * `AppThemeScope` eles leem o tema que está sendo montado, então o que aparece
 * é o que a carteira vai ver — e não uma imitação que envelhece sozinha. Só os
 * gráficos recebem cor explícita, porque cor de série é dado. */

const barData = [
  { month: 'Jan', '2025': 180, '2026': 220 },
  { month: 'Fev', '2025': 150, '2026': 190 },
  { month: 'Mar', '2025': 200, '2026': 260 },
  { month: 'Abr', '2025': 170, '2026': 210 },
  { month: 'Mai', '2025': 230, '2026': 280 },
  { month: 'Jun', '2025': 190, '2026': 250 },
]

const returnsData = [
  { date: 'Jan', Carteira: 1.2, CDI: 0.9 },
  { date: 'Fev', Carteira: 2.5, CDI: 1.8 },
  { date: 'Mar', Carteira: 1.8, CDI: 2.7 },
  { date: 'Abr', Carteira: 4.1, CDI: 3.6 },
  { date: 'Mai', Carteira: 3.2, CDI: 4.5 },
  { date: 'Jun', Carteira: 6.0, CDI: 5.4 },
]

const pieData = [
  { name: 'Ações BR', value: 35 },
  { name: 'FIIs', value: 25 },
  { name: 'Renda Fixa', value: 20 },
  { name: 'Cripto', value: 10 },
  { name: 'Ações US', value: 10 },
]

const pieTotal = pieData.reduce((sum, slice) => sum + slice.value, 0)

interface Props {
  config: ThemePaletteConfig
}

export default function ThemePreviewPanel({ config }: Props) {
  const colors = config.chart.colors

  const swatches = [
    { label: 'Primary', color: config.primary },
    { label: 'Secondary', color: config.secondary },
    { label: 'Sucesso', color: config.success },
    { label: 'Erro', color: config.error },
    { label: 'Aviso', color: config.warning },
    { label: 'Info', color: config.info },
    { label: 'Golden', color: config.golden },
  ]

  return (
    <AppThemeScope palette={config} title="Preview do Tema">
      <AppStack gap="md">
        <AppStack direction="row" gap="sm" wrap>
          {swatches.map((swatch) => (
            <AppChip key={swatch.label} label={swatch.label} tint={swatch.color} />
          ))}
        </AppStack>

        <AppCard>
          <AppStack gap="sm">
            <SectionTitle>Proventos por Mês</SectionTitle>
            <AppChartArea height={220}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={config.chart.grid} />
                  <XAxis dataKey="month" stroke={config.text.primary} tick={{ fontSize: 12 }} />
                  <YAxis orientation="right" stroke={config.text.primary} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="2025" fill={config.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="2026" fill={config.secondary} radius={[4, 4, 0, 0]} />
                  <ReferenceLine
                    y={210}
                    stroke={config.text.primary}
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                  />
                </BarChart>
              </ResponsiveContainer>
            </AppChartArea>
          </AppStack>
        </AppCard>

        <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
          <AppCard>
            <AppStack gap="sm">
              <SectionTitle>Rentabilidade Acumulada</SectionTitle>
              <AppChartArea height={200}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={returnsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={config.chart.grid} />
                    <XAxis dataKey="date" stroke={config.text.primary} tick={{ fontSize: 12 }} />
                    <YAxis
                      orientation="right"
                      stroke={config.text.primary}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Carteira"
                      stroke={config.primary}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="CDI"
                      stroke={config.secondary}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </AppChartArea>
            </AppStack>
          </AppCard>

          <AppCard>
            <AppStack gap="sm">
              <SectionTitle>Alocação por Classe</SectionTitle>
              <AppChartArea height={200}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={(props) =>
                        `${String(props.name ?? '')} ${((Number(props.value ?? 0) / pieTotal) * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={colors[i % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </AppChartArea>
            </AppStack>
          </AppCard>
        </AppGrid>

        <AppCard>
          <AppStack gap="xs">
            <AppText variant="cardValue">Título de Exemplo</AppText>
            <AppText>Texto primário para verificar legibilidade sobre o fundo.</AppText>
            <AppText variant="bodySmall" tone="secondary">
              Texto secundário em tom mais suave para informações complementares.
            </AppText>
          </AppStack>
        </AppCard>
      </AppStack>
    </AppThemeScope>
  )
}
