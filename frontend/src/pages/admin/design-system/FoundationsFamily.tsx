import {
  AppAlert,
  AppButton,
  AppCard,
  AppChip,
  AppColorSwatch,
  AppDivider,
  AppGrid,
  AppGridItem,
  AppIconButton,
  AppProgressBar,
  AppStack,
  AppStackItem,
  AppText,
  AppThemeScope,
  radius,
  space,
  useAppTheme,
  type SpaceToken,
} from '@/components/ui'
import { DEFAULT_DARK_THEME_ID, getPresetById } from '@/theme/themes'
import DeleteIcon from '@mui/icons-material/Delete'
import { Entry, Matrix, State, States } from './Specimen'

const INTENTS = ['primary', 'info', 'success', 'caution', 'danger'] as const
const SURFACES = ['AppButton', 'AppIconButton', 'AppChip', 'AppText', 'AppAlert', 'AppProgressBar'] as const
const SPACE_TOKENS = Object.keys(space) as SpaceToken[]

/** Uma cor do tema com o nome dela embaixo. */
function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <State label={label}>
      <AppColorSwatch color={color} shape="large" />
    </State>
  )
}

/* Uma célula da matriz de intenção: o mesmo nome em cada componente que tem
 * tom, ou o traço onde o componente não aceita aquela intenção. */
function IntentCell({ intent, surface }: { intent: (typeof INTENTS)[number]; surface: (typeof SURFACES)[number] }) {
  const none = (
    <AppText variant="caption" tone="disabled">
      —
    </AppText>
  )
  switch (surface) {
    case 'AppButton':
      return intent === 'primary' || intent === 'danger' || intent === 'caution' ? (
        <AppButton tone={intent} size="sm">
          {intent}
        </AppButton>
      ) : (
        none
      )
    case 'AppIconButton':
      return intent === 'primary' || intent === 'danger' ? (
        <AppIconButton label={intent} tone={intent} size="sm">
          <DeleteIcon fontSize="small" />
        </AppIconButton>
      ) : (
        none
      )
    case 'AppChip':
      return <AppChip label={intent} tone={intent} />
    case 'AppText':
      return intent === 'info' ? (
        none
      ) : (
        <AppText variant="bodySmall" tone={intent}>
          {intent}
        </AppText>
      )
    case 'AppAlert':
      return intent === 'info' || intent === 'success' || intent === 'danger' ? (
        <AppAlert tone={intent}>{intent}</AppAlert>
      ) : (
        none
      )
    case 'AppProgressBar':
      return intent === 'primary' || intent === 'danger' ? (
        <AppStack direction="row">
          <AppStackItem width={120}>
            <AppProgressBar value={60} tone={intent} />
          </AppStackItem>
        </AppStack>
      ) : (
        none
      )
  }
}

export default function FoundationsFamily() {
  const theme = useAppTheme()
  const { palette } = theme

  return (
    <AppStack gap="lg">
      <Entry
        name="Paleta"
        role="As cores do tema em uso. Nenhum componente escreve cor à mão: ou lê daqui, ou recebe a cor do dado."
      >
        <States label="Papéis">
          <Swatch color={palette.primary.main} label="primary" />
          <Swatch color={palette.secondary.main} label="secondary" />
          <Swatch color={palette.info.main} label="info" />
          <Swatch color={palette.success.main} label="success" />
          <Swatch color={palette.warning.main} label="caution" />
          <Swatch color={palette.error.main} label="danger" />
          <Swatch color={palette.golden} label="golden" />
        </States>
        <States label="Superfície e texto">
          <Swatch color={palette.background.default} label="background" />
          <Swatch color={palette.background.paper} label="paper" />
          <Swatch color={palette.text.primary} label="text" />
          <Swatch color={palette.text.secondary} label="text secondary" />
          <Swatch color={palette.divider} label="divider" />
        </States>
        <States label="Séries de gráfico, na ordem em que são consumidas">
          {palette.chart.colors.map((color, index) => (
            <Swatch key={color} color={color} label={String(index + 1)} />
          ))}
        </States>
      </Entry>

      <Entry
        name="Intenção"
        role="Um nome por intenção em todo componente que tem tom (src/components/ui/intent.ts). O traço é onde o componente não aceita aquela intenção — de propósito."
      >
        <Matrix rows={INTENTS} cols={SURFACES} render={(intent, surface) => <IntentCell intent={intent} surface={surface} />} />
      </Entry>

      <Entry
        name="AppColorSwatch"
        role="A amostra de uma cor que vem do dado — a da categoria, a da série. Ao lado do que ela identifica, nunca como enfeite."
      >
        <States>
          {(['square', 'bar', 'dot', 'large'] as const).map((shape) => (
            <State key={shape} label={shape}>
              <AppColorSwatch color={palette.chart.colors[0]} shape={shape} />
            </State>
          ))}
        </States>
      </Entry>

      <Entry
        name="Espaço e raio"
        role="Toda distância entre coisas sai de space, e todo canto de radius (src/theme/tokens.ts). O espaço aparece aqui como o vão entre duas amostras."
      >
        <States label="space">
          {SPACE_TOKENS.map((token) => (
            <State key={token} label={`${token} · ${theme.spacing(space[token])}`}>
              <AppStack direction="row" gap={token}>
                <AppColorSwatch color={palette.primary.main} />
                <AppColorSwatch color={palette.primary.main} />
              </AppStack>
            </State>
          ))}
        </States>
        <States label="radius">
          {Object.entries(radius).map(([token, value]) => (
            <AppText key={token} variant="bodySmall">
              {token} · {value}px
            </AppText>
          ))}
        </States>
      </Entry>

      <Entry
        name="AppStack"
        role="Flex. Linha ou coluna, com o espaço entre os filhos vindo de um token. AppStackItem é o filho que reparte o espaço livre."
      >
        <States>
          <State label="direction=row · gap=sm">
            <AppStack direction="row" gap="sm">
              <AppChip label="um" />
              <AppChip label="dois" />
              <AppChip label="três" />
            </AppStack>
          </State>
          <State label="direction=column · gap=xs">
            <AppStack gap="xs">
              <AppChip label="um" />
              <AppChip label="dois" />
            </AppStack>
          </State>
          <State label="justify=between">
            <AppCard padding="sm" width={280}>
              <AppStack direction="row" justify="between">
                <AppChip label="início" />
                <AppChip label="fim" />
              </AppStack>
            </AppCard>
          </State>
          <State label="AppStackItem grow=2 / grow=1">
            <AppCard padding="sm" width={280}>
              <AppStack direction="row" gap="sm">
                <AppStackItem grow={2}>
                  <AppProgressBar value={100} />
                </AppStackItem>
                <AppStackItem>
                  <AppProgressBar value={100} tone="danger" />
                </AppStackItem>
              </AppStack>
            </AppCard>
          </State>
        </States>
      </Entry>

      <Entry
        name="AppGrid"
        role="Grade CSS: o pai diz quantas colunas existem e os filhos fluem. AppGridItem span é a célula que ocupa mais de uma."
      >
        <AppGrid cols={{ xs: 1, md: 3 }} gap="sm">
          <AppGridItem span={{ xs: 1, md: 2 }}>
            <AppCard padding="sm">
              <AppText variant="caption">AppGridItem span=2</AppText>
            </AppCard>
          </AppGridItem>
          <AppCard padding="sm">
            <AppText variant="caption">1</AppText>
          </AppCard>
          <AppCard padding="sm">
            <AppText variant="caption">1</AppText>
          </AppCard>
          <AppCard padding="sm">
            <AppText variant="caption">1</AppText>
          </AppCard>
          <AppCard padding="sm">
            <AppText variant="caption">1</AppText>
          </AppCard>
        </AppGrid>
      </Entry>

      <Entry name="AppDivider" role="A régua neutra entre blocos. Nunca colorida: cor é identidade de série.">
        <States>
          <State label="horizontal">
            <AppStack gap="sm">
              <AppText variant="bodySmall">acima</AppText>
              <AppDivider />
              <AppText variant="bodySmall">abaixo</AppText>
            </AppStack>
          </State>
          <State label="vertical">
            <AppStack direction="row" gap="sm" align="center">
              <AppText variant="bodySmall">esquerda</AppText>
              <AppDivider orientation="vertical" />
              <AppText variant="bodySmall">direita</AppText>
            </AppStack>
          </State>
        </States>
      </Entry>

      <Entry
        name="AppThemeScope"
        role="Um pedaço de tela pintado por outro tema. Aqui, as mesmas peças sob o tema escuro padrão: é como se confere que um componente não depende do tema claro."
      >
        <AppThemeScope palette={getPresetById(DEFAULT_DARK_THEME_ID)!.palette} title="Tema escuro padrão">
          <AppStack direction="row" gap="sm" wrap align="center">
            <AppButton>primary</AppButton>
            <AppButton emphasis="outline">outline</AppButton>
            <AppButton tone="danger" emphasis="ghost">
              danger · ghost
            </AppButton>
            <AppChip label="success" tone="success" />
            <AppChip label="neutral" />
            <AppText variant="bodySmall" tone="secondary">
              texto secundário
            </AppText>
          </AppStack>
        </AppThemeScope>
      </Entry>
    </AppStack>
  )
}
