import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppImmersiveScene, AppStack, AppText } from '@/components/ui'
import { fetchWealthTiers } from '@/api/wealth-tier'
import { tierScene } from '@/constants/tierScenes'
import { useCurrency } from '@/hooks/useCurrency'
import { useWealthTier } from '@/queries/portfolio'
import type { WealthTier } from '@/types'
import TierStanding, { type TierState } from './TierStanding'

/* A Jornada do Herói: a escala como uma sequência de cenários.
 *
 * Cada degrau é um lugar, e o lugar ocupa a janela inteira — sem moldura, sem
 * margem, sem card. É a diferença entre olhar a foto de uma paisagem e estar
 * nela, e é a razão de o cenário ser uma camada fixa por trás da página em vez
 * de um bloco dentro da faixa de conteúdo: a moldura do app tem respiro de
 * todos os lados, e é justamente esse respiro que uma paisagem não pode ter.
 *
 * O que foi conquistado pode ser revisitado; o que falta aparece como uma
 * silhueta com um "?", porque revelar o cenário antes da hora gasta de graça a
 * única coisa que ele tem para dar quando chegar o dia.
 *
 * A escala continua sendo dado: nome e alvo vêm do banco. O cenário, não — ele
 * é arquivo do repositório, escolhido pela posição do degrau. Ver
 * `constants/tierScenes`.
 *
 * `current_tier` vem do pico do patrimônio, e não do valor de hoje: uma
 * patente é alcançada uma vez e não regride. A travessia escrita ao lado do
 * nome olha o valor de hoje, que é a outra pergunta — o quanto ainda falta de
 * verdade. Nome e travessia são um bloco só: ver `TierStanding`. */

export default function PortfolioTiersPage() {
  const { data: standing = null, isLoading } = useWealthTier()
  const { format: formatCurrency } = useCurrency()
  const [tiers, setTiers] = useState<WealthTier[]>([])
  /* O foco começa na patente atual e passa a ser de quem olha assim que ele
     escolhe outra: `null` quer dizer "ainda a atual". */
  const [focused, setFocused] = useState<number | null>(null)

  useEffect(() => {
    fetchWealthTiers()
      .then(setTiers)
      .catch((error) => console.error('Erro ao carregar patentes:', error))
  }, [])

  /* Do primeiro degrau ao último, que é a ordem em que a escala se percorre e
     também a ordem em que os cenários foram desenhados. */
  const ladder = useMemo(() => [...tiers].sort((a, b) => a.rank - b.rank), [tiers])
  const current = standing?.current_tier ?? null

  const stateOf = useCallback(
    (tier: WealthTier): TierState => {
      if (!current) return 'locked'
      if (tier.rank === current.rank) return 'current'
      return tier.rank < current.rank ? 'done' : 'locked'
    },
    [current],
  )

  const currentIndex = Math.max(
    ladder.findIndex((tier) => tier.rank === current?.rank),
    0,
  )
  const index = Math.min(focused ?? currentIndex, Math.max(ladder.length - 1, 0))
  const tier = ladder[index]
  const state = tier ? stateOf(tier) : 'locked'
  const scene = tierScene(index)

  const move = (delta: number) =>
    setFocused(Math.min(Math.max(index + delta, 0), ladder.length - 1))

  /* As setas do teclado percorrem a galeria: numa tela que é uma sequência de
     imagens, é o gesto que se tenta antes de procurar um botão. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') move(1)
      if (event.key === 'ArrowLeft') move(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <AppImmersiveScene
      src={scene}
      alt={state === 'locked' ? 'Cenário ainda bloqueado' : (tier?.name ?? '')}
      locked={state === 'locked'}
    >
      {/* Um bloco de texto só, no alto à direita: o nome do lugar e a
          data em que se sai dele são a mesma frase, e separá-los em dois
          cantos da tela punha os dois brigando pela leitura. O título da
          página fica à esquerda, pequeno, como assinatura da tela. */}
      <AppStack direction="row" gap="md" justify="between" align="start" collapseBelow="md">
        <AppText variant="pageHeading">Jornada do Herói</AppText>

        <TierStanding
          tier={tier ?? null}
          state={state}
          standing={standing}
          loading={isLoading}
          formatCurrency={formatCurrency}
          onPrevious={() => move(-1)}
          onNext={() => move(1)}
          hasPrevious={index > 0}
          hasNext={index < ladder.length - 1}
        />
      </AppStack>
    </AppImmersiveScene>
  )
}
