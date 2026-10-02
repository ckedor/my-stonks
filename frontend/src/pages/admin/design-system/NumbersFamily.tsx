import {
  AppMetric,
  AppMetricRow,
  AppStack,
  AppText,
  MiniDonut,
  Sparkline,
  useAppTheme,
  type AppMetricProps,
} from '@/components/ui'
import { Entry, Matrix, State, States } from './Specimen'

type Size = NonNullable<AppMetricProps['size']>
type Tone = NonNullable<AppMetricProps['tone']>

const SIZES: readonly Size[] = ['lg', 'sm']
const TONES: readonly Tone[] = ['default', 'secondary', 'success', 'danger']

const MONTHLY = [2.1, -0.4, 1.3, 0.8, -1.2, 2.4, 1.1, 0.3, -0.6, 1.9, 0.7, 1.5]
const PAYMENTS = [0.82, 0.85, 0.85, 0.88, 0.9, 0.92]

export default function NumbersFamily() {
  const theme = useAppTheme()
  const [first, second] = theme.palette.chart.colors

  return (
    <AppStack gap="lg">
      <Entry
        name="AppMetric"
        role="Um número com o nome dele em cima. O rótulo é pequeno e apagado; o valor é o que se lê. Um rótulo com número grande escrito à mão é esta peça com outro nome."
      >
        <Matrix
          label="size × tone"
          rows={SIZES}
          cols={TONES}
          render={(size, tone) => <AppMetric size={size} tone={tone} label="Retorno" value="+12,4%" />}
        />
        <States label="Modificadores">
          <State label="suffix">
            <AppMetric
              label="Dividend yield"
              value="8,1%"
              suffix={
                <AppText variant="caption" tone="secondary">
                  12 meses
                </AppText>
              }
            />
          </State>
          <State label="hint · rótulo que é jargão">
            <AppMetric label="P/VP" value="0,94" hint="Preço sobre valor patrimonial da cota" />
          </State>
          <State label="align=center · legenda de gráfico">
            <AppMetric label="Máxima" value="R$ 46,10" align="center" />
          </State>
        </States>
      </Entry>

      <Entry
        name="AppMetricRow"
        role="Uma fileira de AppMetric alinhada: rótulos numa linha, números noutra, mesmo misturando lg e sm."
      >
        <AppMetricRow>
          <AppMetric size="lg" label="Patrimônio" value="R$ 31.790,00" />
          <AppMetric label="Investido" value="R$ 27.749,00" />
          <AppMetric label="Lucro" value="+14,6%" tone="success" />
          <AppMetric label="No mês" value="−0,8%" tone="danger" />
        </AppMetricRow>
      </Entry>

      <Entry name="MiniDonut" role="O peso de um item no todo, com o número dentro — o mesmo na lista e nos cards.">
        <States>
          {[8, 43, 91].map((value) => (
            <State key={value} label={`value=${value}`}>
              <MiniDonut value={value} color={first} />
            </State>
          ))}
          <State label="size=48">
            <MiniDonut value={43} color={second} size={48} />
          </State>
        </States>
      </Entry>

      <Entry
        name="Sparkline"
        role="Só a forma de uma série, sem eixo nem rótulo. bars para eventos que aconteceram, line para amostras de algo contínuo."
      >
        <States>
          <State label="line">
            <Sparkline values={MONTHLY} color={first} />
          </State>
          <State label="line · baseline=0">
            <Sparkline values={MONTHLY} color={first} baseline={0} />
          </State>
          <State label="bars · titles">
            <Sparkline
              values={PAYMENTS}
              color={second}
              variant="bars"
              titles={PAYMENTS.map((value) => `R$ ${value.toFixed(2)}`)}
            />
          </State>
        </States>
      </Entry>
    </AppStack>
  )
}
