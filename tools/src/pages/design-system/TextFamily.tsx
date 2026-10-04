import {
  AppBreadcrumbs,
  AppBulletList,
  AppButton,
  AppGroupHeader,
  AppLink,
  AppMetric,
  AppMetricRow,
  AppPageHeader,
  AppStack,
  AppText,
  FieldLabel,
  PageTitle,
  SectionLabel,
  SectionTitle,
  useAppTheme,
  type AppTextProps,
} from '@/components/ui'
import { Entry, Matrix, State, States } from './Specimen'

type Variant = NonNullable<AppTextProps['variant']>
type Tone = NonNullable<AppTextProps['tone']>

const VARIANTS: readonly Variant[] = ['display', 'pageHeading', 'cardValue', 'body', 'bodySmall', 'caption']
const TONES: readonly Tone[] = ['default', 'secondary', 'primary', 'success', 'caution', 'danger', 'disabled']

export default function TextFamily() {
  const theme = useAppTheme()

  return (
    <AppStack gap="lg">
      <Entry
        name="Três níveis de título, e só três"
        role="PageTitle nomeia a tela, SectionTitle um bloco dentro dela, SectionLabel o assunto de um grupo de itens. Lado a lado, na ordem em que aparecem numa tela."
      >
        <AppStack gap="md">
          <PageTitle>PageTitle — o nome da tela</PageTitle>
          <SectionTitle>SectionTitle — um bloco dentro dela</SectionTitle>
          <SectionLabel>SectionLabel — o assunto de um grupo</SectionLabel>
          <AppText variant="bodySmall">Texto corrido abaixo dos três.</AppText>
        </AppStack>
      </Entry>

      <Entry name="PageTitle" role="O título da tela. Nas telas do produto ele vem dentro do AppPageHeader, não solto.">
        <States>
          <State label="default">
            <PageTitle>Rentabilidade</PageTitle>
          </State>
          <State label="tone=danger · tela de bloqueio">
            <PageTitle tone="danger">Acesso negado</PageTitle>
          </State>
        </States>
      </Entry>

      <Entry name="SectionTitle" role="O título de um bloco que se lê como conteúdo.">
        <States>
          <State label="standard">
            <SectionTitle>Posições</SectionTitle>
          </State>
          <State label="prominence=lead · abre uma leitura completa">
            <SectionTitle prominence="lead">O que mudou no mês</SectionTitle>
          </State>
        </States>
      </Entry>

      <Entry name="SectionLabel" role="O assunto de um grupo de itens: pequeno, em caixa alta, na cor de apoio.">
        <AppStack gap="sm">
          <SectionLabel>Oscilação</SectionLabel>
          <AppMetricRow>
            <AppMetric label="Dia" value="+0,8%" tone="success" />
            <AppMetric label="Mês" value="−2,1%" tone="danger" />
            <AppMetric label="Ano" value="+11,4%" tone="success" />
          </AppMetricRow>
        </AppStack>
      </Entry>

      <Entry
        name="AppGroupHeader"
        role="O cabeçalho de um grupo numa lista longa — a categoria acima dos ativos dela. Mesmo desenho do SectionLabel, com régua neutra."
      >
        <AppStack gap="md">
          <State label="só o título">
            <AppGroupHeader title="Ações" />
          </State>
          <State label="trailing">
            <AppGroupHeader title="FIIs" trailing={<AppText variant="bodySmall">R$ 13.113,00</AppText>} />
          </State>
          <State label="onTitleClick · o grupo tem página própria">
            <AppGroupHeader title="Renda fixa" onTitleClick={() => undefined} />
          </State>
        </AppStack>
      </Entry>

      <Entry name="FieldLabel" role="O rótulo parado acima do campo, quando a linha dele carrega mais que o nome.">
        <AppStack direction="row" justify="between" align="center">
          <FieldLabel>Senha</FieldLabel>
          <AppLink to="/login">Esqueci minha senha</AppLink>
        </AppStack>
      </Entry>

      <Entry
        name="AppText"
        role="Todo texto que não é título. Os nomes são semânticos: a tela pede bodySmall porque aquilo é texto de apoio, não porque quer 14px."
      >
        <Matrix
          label="variant × tone"
          rows={VARIANTS}
          cols={TONES}
          render={(variant, tone) => (
            <AppText variant={variant} tone={tone} noWrap>
              Aa
            </AppText>
          )}
        />
        <States label="Modificadores">
          <State label="weight=strong">
            <AppText variant="bodySmall" weight="strong">
              PETR4
            </AppText>
          </State>
          <State label="inline">
            <AppText variant="bodySmall">
              Subiu{' '}
              <AppText variant="bodySmall" tone="success" inline>
                +4,2%
              </AppText>{' '}
              no mês.
            </AppText>
          </State>
          <State label="tint · cor do dado">
            <AppText variant="bodySmall" tint={theme.palette.chart.colors[1]}>
              Bolsa BR
            </AppText>
          </State>
          <State label="gradient · a conquista">
            <AppText variant="pageHeading" gradient>
              Patente nova
            </AppText>
          </State>
        </States>
      </Entry>

      <Entry
        name="AppPageHeader"
        role="A abertura de toda tela do produto: rastro, título, ações, descrição e métricas. Não tem prop de cor, e a falta é a regra."
      >
        <AppStack gap="lg">
          <State label="só o título">
            <AppPageHeader title="Distribuição" />
          </State>
          <State label="completo">
            <AppPageHeader
              title="PETR4"
              breadcrumbs={[
                { label: 'Carteira', href: '/portfolio/overview' },
                { label: 'Ativos', href: '/portfolio/asset' },
                { label: 'PETR4' },
              ]}
              description="Petrobras PN · Ação"
              actions={<AppButton emphasis="outline">Registrar compra</AppButton>}
              metrics={
                <AppMetricRow>
                  <AppMetric size="lg" label="Posição" value="R$ 13.800,00" />
                  <AppMetric label="Lucro" value="+41,98%" tone="success" />
                  <AppMetric label="Peso" value="43%" />
                </AppMetricRow>
              }
            />
          </State>
        </AppStack>
      </Entry>

      <Entry name="AppBreadcrumbs" role="O rastro solto, fora do AppPageHeader — que já traz o dele.">
        <AppBreadcrumbs
          items={[{ label: 'Dev', href: '/dev' }, { label: 'Design System', href: '/dev/design-system' }, { label: 'Texto' }]}
        />
      </Entry>

      <Entry name="AppBulletList" role="Uma lista curta de frases, sem ordem entre elas.">
        <States>
          <State label="body · default">
            <AppBulletList items={['Primeiro ponto', 'Segundo ponto']} />
          </State>
          <State label="bodySmall · secondary">
            <AppBulletList variant="bodySmall" tone="secondary" items={['Primeiro ponto', 'Segundo ponto']} />
          </State>
        </States>
      </Entry>

      <Entry name="AppLink" role="Link de texto, para rota interna ou endereço externo.">
        <States>
          <State label="to · rota interna">
            <AppLink to="/dev/design-system/acoes">Ver ações</AppLink>
          </State>
          <State label="href · externo">
            <AppLink href="https://example.com">example.com</AppLink>
          </State>
        </States>
      </Entry>
    </AppStack>
  )
}
