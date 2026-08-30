import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LockIcon from '@mui/icons-material/Lock'
import {
  AppIconButton,
  AppImmersiveCaption,
  AppProgressBar,
  AppSkeleton,
  AppStack,
  AppText,
} from '@/components/ui'
import type { PortfolioWealthTier, WealthTier } from '@/types'

/* Quem se é hoje, e quando se deixa de ser: uma coisa só, escrita sobre a
 * paisagem.
 *
 * O nome do cenário e a travessia até o próximo eram dois blocos em cantos
 * opostos da tela, e brigavam — os dois são a mesma frase, "este é o lugar
 * onde estou e este é o dia em que saio dele". Juntos, viram um bloco de
 * texto só.
 *
 * E texto, não cartão: uma superfície de vidro sobre a arte é uma janela de
 * app pousada numa paisagem, e o que se quer é uma legenda escrita nela. O que
 * dá legibilidade é a sombra sob as letras e o escurecimento do próprio
 * cenário, que já existe para isso. */

/** Anos e meses, e não trinta e sete meses: quem lê a barra quer saber se a
 *  espera é de meses ou de anos, e o número cru esconde justamente isso. */
function formatMonths(months: number): string {
  if (months < 12) return months <= 1 ? '1 mês' : `${months} meses`
  const years = Math.floor(months / 12)
  const rest = months % 12
  const yearLabel = years === 1 ? '1 ano' : `${years} anos`
  if (rest === 0) return yearLabel
  return `${yearLabel} e ${rest === 1 ? '1 mês' : `${rest} meses`}`
}

const MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

/** Mês e ano: a projeção não tem precisão de dia, e escrever um só faria a
 *  conta parecer mais certa do que é. */
function formatTargetDate(iso: string): string {
  const [year, month] = iso.split('-')
  return `${MONTHS[Number(month) - 1]}/${year}`
}

export type TierState = 'done' | 'current' | 'locked'

const EYEBROW: Record<TierState, string> = {
  current: 'Você é isto hoje',
  done: 'Já foi isto',
  locked: 'Ainda bloqueado',
}

export interface TierStandingProps {
  /** O degrau aberto. Ausente enquanto a escala não chegou. */
  tier: WealthTier | null
  state: TierState
  /** A posição da carteira na escala. Ausente enquanto carrega. */
  standing: PortfolioWealthTier | null
  loading: boolean
  formatCurrency: (value: number) => string
  onPrevious: () => void
  onNext: () => void
  hasPrevious: boolean
  hasNext: boolean
}

export default function TierStanding({
  tier,
  state,
  standing,
  loading,
  formatCurrency,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: TierStandingProps) {
  const next = standing?.next_tier ?? null
  const projection = standing?.projection ?? null
  const locked = state === 'locked'

  /* A travessia é sobre o degrau em que se está. Folheando cenários antigos ou
     futuros, o texto de baixo continua sendo o do lugar aberto, e a projeção
     sai de cena em vez de dizer uma data que não é sobre ele. */
  const showsProgress = state === 'current'

  return (
    <AppImmersiveCaption>
      <AppStack gap="xs">
        <AppText variant="caption" tone={locked ? 'secondary' : 'caution'}>
          {EYEBROW[state]}
        </AppText>

        {/* As setas ladeiam o nome: virar a página do álbum é a mesma ação de
            ler onde se está. */}
        <AppStack direction="row" gap="xs" align="center" justify="end">
          <AppIconButton
            onClick={onPrevious}
            disabled={!hasPrevious}
            label="Cenário anterior"
            immersive
          >
            <ChevronLeftIcon />
          </AppIconButton>

          <AppText
            variant="sceneHeading"
            tone={locked ? 'disabled' : 'inverse'}
          >
            {locked ? '???' : (tier?.name ?? '—')}
          </AppText>

          <AppIconButton
            onClick={onNext}
            disabled={!hasNext}
            label="Próximo cenário"
            immersive
          >
            <ChevronRightIcon />
          </AppIconButton>
        </AppStack>

        {tier && (
          <AppStack direction="row" gap="xs" align="center" justify="end">
            {locked && (
              <AppText variant="caption" tone="secondary" inline>
                <LockIcon fontSize="inherit" />
              </AppText>
            )}
            <AppText variant="bodySmall" tone="secondary">
              {locked ? 'Desbloqueia em ' : 'Alcançada em '}
              <AppText variant="bodySmall" weight="strong" tone="caution" inline>
                {formatCurrency(tier.threshold)}
              </AppText>
            </AppText>
          </AppStack>
        )}

        {/* Enquanto a posição não chega, a silhueta do texto fica no lugar: um
            bloco que aparece depois empurraria a legenda inteira. */}
        {loading ? (
          <AppStack gap="xs" align="end">
            <AppSkeleton height={12} />
            <AppSkeleton shape="text" width="70%" height={16} />
            <AppSkeleton shape="text" width="55%" height={16} />
          </AppStack>
        ) : (
          showsProgress &&
          standing && (
            <AppStack gap="xs">
              <AppProgressBar value={standing.progress * 100} tone="golden" thickness={12} glow />

              <AppStack direction="row" gap="sm" justify="between" align="baseline" wrap>
                <AppText variant="caption" tone="secondary">
                  Hoje{' '}
                  <AppText variant="caption" weight="strong" inline>
                    {formatCurrency(standing.current_patrimony)}
                  </AppText>
                </AppText>
                {standing.remaining != null && next && (
                  <AppText variant="caption" tone="secondary" noWrap>
                    Faltam{' '}
                    <AppText variant="caption" weight="strong" inline>
                      {formatCurrency(standing.remaining)}
                    </AppText>{' '}
                    para{' '}
                    <AppText variant="caption" weight="strong" tone="caution" inline>
                      {next.name}
                    </AppText>
                  </AppText>
                )}
              </AppStack>

              {projection && (
                <>
                  {/* A data é o que a barra provoca, então ela é a linha
                      grande; o ritmo que a produziu vem miúdo logo abaixo,
                      porque uma data sem ele é um palpite com cara de
                      promessa. */}
                  <AppText variant="cardValue">
                    {formatTargetDate(projection.target_date)}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    em{' '}
                    <AppText variant="caption" weight="strong" tone="caution" inline>
                      {formatMonths(projection.months)}
                    </AppText>
                    , no ritmo da carteira: aportes de{' '}
                    <AppText variant="caption" weight="strong" inline>
                      {formatCurrency(projection.monthly_contribution)}
                    </AppText>
                    /mês e CAGR de{' '}
                    <AppText variant="caption" weight="strong" inline>
                      {(projection.annual_rate * 100).toFixed(1)}%
                    </AppText>{' '}
                    ao ano
                  </AppText>
                </>
              )}
            </AppStack>
          )
        )}
      </AppStack>
    </AppImmersiveCaption>
  )
}
