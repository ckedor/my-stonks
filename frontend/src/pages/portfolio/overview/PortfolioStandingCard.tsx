import { AppProgressBar, AppStack, AppStackItem, AppText } from '@/components/ui'
import type { PortfolioWealthTier } from '@/types'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'

/* Onde a carteira está: quanto ela vale e que patente isso lhe rendeu.
 *
 * Um bloco só, e não dois empilhados: a patente encabeça o valor em vez de
 * abrir um grupo visual próprio embaixo dele.
 *
 * Sem o rótulo "Patrimônio": o número está no topo da tela da carteira, no
 * tamanho de título, e nomear o óbvio só gasta uma linha.
 *
 * O degrau seguinte fecha a linha que a barra explica, do lado oposto ao que
 * falta: os dois são a mesma frase lida de pontas diferentes — quanto falta, e
 * falta para quê.
 *
 * O título vem do pico do patrimônio: uma patente é alcançada uma vez e não
 * regride. A barra e o "Faltam" vêm do valor de hoje, que é outra pergunta —
 * quem caiu mantém o título e vê a distância que de fato tem para subir. Os
 * dois números chegam prontos; o card não recalcula nenhum deles.
 *
 * A escala é dado, editável pelo admin. O card não sabe quantos degraus ela
 * tem, nem qual é o primeiro ou o último: `next_tier` ausente é o topo.
 *
 * Sem superfície própria: o bloco abre a página e é lido como o cabeçalho
 * dela, não como um cartão pousado ali. A arte do personagem não mora aqui —
 * ela tem uma página só dela, a Jornada do Herói. */

const BAR_THICKNESS = 10
const BAR_WIDTH = 300

export interface PortfolioStandingCardProps {
  /** Quanto a carteira vale hoje. */
  patrimony: number
  /** Retorno anualizado em pontos percentuais. Ausente quando não há série. */
  cagr: number | null
  /** O CAGR como percentual do CDI. Ausente quando não há benchmark. */
  cdiPct: number | null
  /** A posição na escala. Ausente enquanto não carregou. */
  standing: PortfolioWealthTier | null
  /** A formatação de moeda da tela, para o card não escolher a sua. */
  formatCurrency: (value: number) => string
}


export default function PortfolioStandingCard({
  patrimony,
  cagr,
  cdiPct,
  standing,
  formatCurrency,
}: PortfolioStandingCardProps) {
  const current = standing?.current_tier ?? null
  const next = standing?.next_tier ?? null

  return (
    <AppStack gap="xs">
      {current && (
        <AppStack direction="row" gap="sm" align="center">
          <ShieldOutlinedIcon fontSize="small" />
          <AppText variant="bodySmall" weight="strong">
            {current.name}
          </AppText>
        </AppStack>
      )}

      <AppText variant="pageHeading">{formatCurrency(patrimony)}</AppText>

      {cagr != null && (
        <AppStack direction="row" gap="sm" align="baseline" wrap>
          <AppText
            variant="bodySmall"
            weight="strong"
            tone={cagr >= 0 ? 'success' : 'danger'}
          >
            CAGR {cagr >= 0 ? '+' : ''}
            {cagr.toFixed(2)}%
          </AppText>
          {cdiPct != null && (
            <AppText variant="bodySmall" tone="secondary">
              ({cdiPct.toFixed(0)}% do CDI)
            </AppText>
          )}
        </AppStack>
      )}

      {current && next && (
        <AppStack direction="row">
          {/* Largura fixa para a barra e para a linha que a explica: as duas
              medem a mesma coisa, então param no mesmo ponto. Deixá-las
              elásticas fazia a régua se esticar até a borda do bloco. */}
          <AppStackItem width={BAR_WIDTH}>
            <AppStack gap="xs">
              <AppProgressBar
                value={(standing?.progress ?? 0) * 100}
                tone="golden"
                thickness={BAR_THICKNESS}
              />
              <AppStack direction="row" gap="sm" justify="between" align="baseline">
                {standing?.remaining != null && (
                  <AppText variant="caption" tone="secondary">
                    Faltam{' '}
                    <AppText variant="caption" weight="strong" inline>
                      {formatCurrency(standing.remaining)}
                    </AppText>
                  </AppText>
                )}
                <AppText variant="caption" tone="secondary" noWrap>
                  Próximo:{' '}
                  <AppText variant="caption" tone="caution" weight="strong" inline>
                    {next.name}
                  </AppText>
                </AppText>
              </AppStack>
            </AppStack>
          </AppStackItem>
        </AppStack>
      )}
    </AppStack>
  )
}
