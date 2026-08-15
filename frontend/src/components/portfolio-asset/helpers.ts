import { toISODate } from '@/lib/utils/date'
import dayjs from 'dayjs'

/** Um dia da posição consolidada no ativo. */
export interface PositionHistoryEntry {
  date: string
  price: number
  quantity: number
  average_price: number
}

/** Uma compra ou venda. Quantidade negativa é venda. */
export interface TradeEntry {
  date: string
  price: number
  quantity: number
}

/** A posição já no formato do gráfico: `time` em vez de `date`, para reusar o
 *  `filterFrom` de `charts/candle/helpers`; a data reduzida ao dia, que é o que
 *  a biblioteca aceita; e uma ordem garantida, que ela também exige. */
export interface PositionPoint {
  time: string
  price: number
  averagePrice: number
  quantity: number
}

/** Uma operação por dia: o gráfico marca o dia, não cada ordem. Quantidades se
 *  somam e o preço vira a média ponderada do dia. */
export interface DayTrade {
  time: string
  quantity: number
  price: number
  /** Quanto de dinheiro mudou de lado, em módulo. É o que o marcador informa e
   *  o que dá o tamanho dele: comprar 1 cota de R$ 5.000 é um evento maior na
   *  carteira do que comprar 100 de R$ 5. */
  value: number
}

export function toPositionSeries(history: PositionHistoryEntry[]): PositionPoint[] {
  const byDate = new Map<string, PositionPoint>()

  for (const entry of history) {
    const time = toISODate(entry.date)
    byDate.set(time, {
      time,
      price: entry.price,
      averagePrice: entry.average_price,
      quantity: entry.quantity,
    })
  }

  return [...byDate.values()].sort((a, b) => a.time.localeCompare(b.time))
}

/** Junta as operações que caem na mesma data. Compras e vendas se cancelam no
 *  total, e o dia resultante é lido pelo sinal do saldo.
 *
 *  Uma data, uma operação: é o que garante que o marcador, o rótulo e o hover
 *  falem do mesmo evento. */
function mergeByTime(entries: { time: string; quantity: number; price: number }[]): DayTrade[] {
  const byTime = new Map<string, { quantity: number; notional: number }>()

  for (const entry of entries) {
    const acc = byTime.get(entry.time) ?? { quantity: 0, notional: 0 }
    acc.quantity += entry.quantity
    acc.notional += entry.quantity * entry.price
    byTime.set(entry.time, acc)
  }

  return [...byTime.entries()]
    .map(([time, { quantity, notional }]) => ({
      time,
      quantity,
      price: quantity !== 0 ? notional / quantity : 0,
      value: Math.abs(notional),
    }))
    .filter((d) => d.quantity !== 0)
    .sort((a, b) => a.time.localeCompare(b.time))
}

/** Agrupa as operações por dia. */
export function toDayTrades(trades: TradeEntry[]): DayTrade[] {
  return mergeByTime(
    trades.map((trade) => ({
      time: toISODate(trade.date),
      quantity: trade.quantity,
      price: trade.price,
    })),
  )
}

/** Encaixa cada operação em uma data que existe na série desenhada.
 *
 *  A biblioteca só posiciona marcadores sobre pontos da série; uma operação em
 *  um dia sem posição consolidada — um feriado, um fim de semana — sumiria do
 *  gráfico. Cada uma vai para o primeiro ponto igual ou posterior a ela.
 *
 *  O que aconteceu *antes* do início da janela é descartado, não empurrado para
 *  a borda: essas operações não pertencem ao período que está sendo olhado, e
 *  empurrá-las empilhava anos de histórico sobre o primeiro ponto do gráfico.
 *
 *  Duas datas podem cair no mesmo ponto (sábado e domingo na mesma segunda),
 *  então o resultado é reagrupado — senão dois marcadores dividiriam a mesma
 *  data e o hover de um mostraria o outro. */
export function snapTradesToSeries(trades: DayTrade[], seriesTimes: string[]): DayTrade[] {
  return mergeByTime(snapForward(trades, seriesTimes))
}

/** Troca a data de cada item pela primeira data desenhada igual ou posterior.
 *
 *  Espera os itens em ordem — o cursor só anda para a frente — e pode devolver
 *  datas repetidas, que cabe a quem chama reagrupar. */
function snapForward<T extends { time: string }>(items: T[], seriesTimes: string[]): T[] {
  if (!seriesTimes.length) return []

  const first = seriesTimes[0]
  const snapped: T[] = []
  let cursor = 0

  for (const item of items) {
    if (item.time < first) continue
    while (cursor < seriesTimes.length && seriesTimes[cursor] < item.time) cursor++
    if (cursor >= seriesTimes.length) break
    snapped.push({ ...item, time: seriesTimes[cursor] })
  }

  return snapped
}

/** O dinheiro que entrou e saiu da carteira em uma semana.
 *
 *  Só dinheiro, e nenhuma quantidade: somar cotas de ativos diferentes não dá
 *  número nenhum. O sinal do líquido é o que o marcador mostra; o bruto de cada
 *  lado fica para o hover, senão uma semana de troca de ativo — vendeu um,
 *  comprou outro — apareceria como um evento quase nulo sem explicação. */
export interface CashFlow {
  /** Data do marcador: o começo da semana, ou o ponto da série em que ele
   *  coube depois do encaixe. */
  time: string
  /** Começo da semana agregada, preservado através do encaixe. */
  from: string
  /** Compras menos vendas. Positivo é aporte no que está sendo olhado. */
  net: number
  /** Somas por lado, ambas positivas. */
  bought: number
  sold: number
  /** Quantas operações entraram no agregado. */
  count: number
}

/** Agrega operações por semana.
 *
 *  Na curva da carteira inteira o dia é fino demais: quem opera três vezes por
 *  semana cobre a linha de triângulos, e nenhum deles diz nada sozinho. A
 *  semana junta isso em um evento por vez, do tamanho do que ele moveu. */
function weekEnd(from: string): string {
  return dayjs(from).add(6, 'day').format('YYYY-MM-DD')
}

export function toWeekFlows(trades: { date: string; value: number }[]): CashFlow[] {
  const byWeek = new Map<string, CashFlow>()

  for (const trade of trades) {
    const week = dayjs(toISODate(trade.date)).startOf('week').format('YYYY-MM-DD')
    const flow = byWeek.get(week) ?? { time: week, from: week, net: 0, bought: 0, sold: 0, count: 0 }
    flow.net += trade.value
    if (trade.value >= 0) flow.bought += trade.value
    else flow.sold += -trade.value
    flow.count += 1
    byWeek.set(week, flow)
  }

  return [...byWeek.values()]
    .filter((flow) => flow.net !== 0)
    .sort((a, b) => a.time.localeCompare(b.time))
}

/** Encaixa as semanas nas datas desenhadas, pelo mesmo motivo de
 *  `snapTradesToSeries`: a biblioteca só põe marcador sobre ponto da série, e o
 *  começo da semana cai num domingo, que nunca é pregão.
 *
 *  Aqui o corte da janela não pode ser o de `snapForward`, que descarta pelo
 *  rótulo: a semana em que a janela começa é rotulada pelo domingo *anterior* a
 *  ela, e seria jogada fora com as operações dentro dela. O que decide é o fim
 *  da semana. */
export function snapFlowsToSeries(flows: CashFlow[], seriesTimes: string[]): CashFlow[] {
  if (!seriesTimes.length) return []

  const first = seriesTimes[0]
  const byTime = new Map<string, CashFlow>()
  let cursor = 0

  for (const week of flows) {
    if (weekEnd(week.from) < first) continue
    while (cursor < seriesTimes.length && seriesTimes[cursor] < week.from) cursor++
    if (cursor >= seriesTimes.length) break

    const flow = { ...week, time: seriesTimes[cursor] }
    const acc = byTime.get(flow.time)
    if (!acc) {
      byTime.set(flow.time, { ...flow })
      continue
    }
    // Duas semanas no mesmo ponto: acontece onde a série tem buraco maior que
    // uma semana. O começo é o da mais antiga.
    acc.from = acc.from < flow.from ? acc.from : flow.from
    acc.net += flow.net
    acc.bought += flow.bought
    acc.sold += flow.sold
    acc.count += flow.count
  }

  return [...byTime.values()]
    .filter((flow) => flow.net !== 0)
    .sort((a, b) => a.time.localeCompare(b.time))
}

/** Preço no eixo, sem centavos onde eles não dizem nada.
 *
 *  Um ativo de R$ 400.000 não ganha informação com os centavos, e eles roubam
 *  largura do eixo. Um de R$ 5,30 ganha — e sem eles duas marcas vizinhas
 *  imprimiriam o mesmo número. A régua é a maior cotação da janela. */
export function formatMoneyAxis(value: number, symbol: string, maxPrice: number): string {
  return `${symbol} ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: moneyDecimals(maxPrice),
    maximumFractionDigits: moneyDecimals(maxPrice),
  })}`
}

export function moneyMinMove(maxPrice: number): number {
  return 10 ** -moneyDecimals(maxPrice)
}

function moneyDecimals(maxPrice: number): number {
  return maxPrice >= 100 ? 0 : 2
}

/** Casas decimais que fazem sentido para a ordem de grandeza da posição: 48
 *  cotas não precisam de decimal nenhum, 0,139 BTC precisa de vários. O eixo
 *  é lido pela maior quantidade da janela, para os rótulos não mudarem de
 *  formato entre uma marca e outra. */
export function formatQuantity(value: number, maxQuantity: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: quantityDecimals(maxQuantity) })
}

/** Menor passo que a escala distingue, na mesma casa decimal do formato. */
export function quantityMinMove(maxQuantity: number): number {
  return 10 ** -quantityDecimals(maxQuantity)
}

function quantityDecimals(maxQuantity: number): number {
  if (maxQuantity >= 1000) return 0
  if (maxQuantity >= 1) return 2
  return 6
}

/** Meses da janela móvel do retorno anualizado. */
export const ROLLING_WINDOW_MONTHS = 12

/** O retorno anualizado móvel, a partir do ponto em que ele existe.
 *
 *  Os primeiros doze meses saem fora: até ali a janela ainda não fechou, e
 *  anualizar meia janela extrapola ruído — dois meses de alta viram uma taxa
 *  anual de três dígitos. A série começa quando a primeira janela completa. */
export function rollingCagrSeries(
  data: { date: string; value: number }[],
): { time: string; value: number }[] {
  if (!data.length) return []

  const opensAt = dayjs(data[0].date).add(ROLLING_WINDOW_MONTHS, 'month')

  return data
    .filter((point) => !dayjs(point.date).isBefore(opensAt))
    .map((point) => ({ time: toISODate(point.date), value: point.value }))
    .sort((a, b) => a.time.localeCompare(b.time))
}

/** A data mais antiga de uma série, sem supor que ela venha ordenada. */
export function firstDate(series: { date: string }[]): string | null {
  let oldest: string | null = null
  for (const point of series) {
    if (oldest === null || point.date < oldest) oldest = point.date
  }
  return oldest
}

/** Valor abreviado, sem centavos: um rótulo sobre a curva tem espaço para a
 *  ordem de grandeza, não para a cifra exata — essa fica no hover. */
export function abbreviateMoney(value: number, symbol: string): string {
  const abs = Math.abs(value)

  if (abs >= 1_000_000) return `${symbol} ${round(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${symbol} ${round(abs / 1_000)}K`
  return `${symbol} ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

/** Uma casa decimal só abaixo de 10, onde ela ainda distingue algo. */
function round(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 ? 1 : 0 })
}

/** Quantas operações da janela levam rótulo. */
export const LABELLED_TRADES = 5

/** As datas que merecem rótulo: as maiores por valor.
 *
 *  Um rótulo ocupa muito mais largura que um triângulo, então em um ativo
 *  operado toda semana eles colidem bem antes dos marcadores e o gráfico vira
 *  um borrão. As maiores operações são as que contam a história; o resto
 *  continua marcado, e o valor exato de qualquer uma está no hover. */
export function labelledTrades(
  trades: { time: string; value: number }[],
  limit = LABELLED_TRADES,
): Set<string> {
  return new Set(
    [...trades]
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .map((trade) => trade.time),
  )
}

/** Rótulo do marcador: só o valor. A direção já está na cor e no sentido do
 *  triângulo, e repeti-la em letra gasta espaço sobre a curva. */
export function tradeLabel(trade: DayTrade, symbol: string): string {
  return abbreviateMoney(trade.value, symbol)
}

/** Tamanho do marcador, entre 0,8 e 2,4, pelo valor da operação em relação à
 *  maior da janela.
 *
 *  Pela raiz, e não linear: a área do triângulo cresce com o quadrado do
 *  tamanho, então a escala linear faria uma operação dez vezes maior parecer
 *  cem vezes maior. E com piso, para a menor operação continuar clicável. */
export function tradeMarkerSize(value: number, maxValue: number): number {
  if (maxValue <= 0) return 1
  return 0.8 + 1.6 * Math.sqrt(Math.min(Math.abs(value) / maxValue, 1))
}

export function tradeMarkerId(time: string): string {
  return `trade:${time}`
}

export function formatDate(time: string): string {
  return dayjs(time).format('DD/MM/YYYY')
}

/** Mês e ano. O começo de uma janela é uma referência, não uma data exata: o
 *  dia exato é ruído ao lado de um retorno acumulado. */
export function formatMonth(time: string): string {
  return dayjs(time).format('MM/YYYY')
}

/** A semana agregada por extenso: "03/02 a 09/02/2026". O marcador está em um
 *  ponto, mas fala de sete dias, e o hover precisa dizer quais. */
export function formatWeek(from: string): string {
  const start = dayjs(from)
  return `${start.format('DD/MM')} a ${start.add(6, 'day').format('DD/MM/YYYY')}`
}
