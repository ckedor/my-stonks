import type { AppTheme } from '@/components/ui'
import { ColorType, type DeepPartial, type ChartOptions } from 'lightweight-charts'

/** A biblioteca trava o espaçamento entre pontos em 0,5px, o que faz uma série
 *  longa não caber no container; 0,02 acomoda uma vida de dados diários. */
export const MIN_BAR_SPACING = 0.02

/** Como todo gráfico do ativo em carteira se veste: fundo transparente para o
 *  card aparecer, cores e fonte vindas do tema, e a escala de tempo capaz de
 *  mostrar a série inteira.
 *
 *  Em um lugar só porque um gráfico que destoa dos outros na mesma página não é
 *  uma escolha de design, é um esquecimento. */
export function baseChartOptions(theme: AppTheme, height: number): DeepPartial<ChartOptions> {
  return {
    height,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: theme.palette.text.secondary,
      fontFamily: theme.typography.fontFamily as string,
    },
    grid: {
      vertLines: { color: theme.palette.chart.grid },
      horzLines: { color: theme.palette.chart.grid },
    },
    crosshair: {
      vertLine: { labelBackgroundColor: theme.palette.primary.main },
      horzLine: { labelBackgroundColor: theme.palette.primary.main },
    },
    rightPriceScale: { borderColor: theme.palette.divider },
    timeScale: {
      borderColor: theme.palette.divider,
      timeVisible: false,
      minBarSpacing: MIN_BAR_SPACING,
    },
  }
}
