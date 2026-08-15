import { describe, expect, it } from 'vitest'

import {
  abbreviateMoney,
  formatQuantity,
  formatWeek,
  formatMoneyAxis,
  labelledTrades,
  moneyMinMove,
  quantityMinMove,
  rollingCagrSeries,
  snapFlowsToSeries,
  snapTradesToSeries,
  toDayTrades,
  toWeekFlows,
  toPositionSeries,
  tradeLabel,
  tradeMarkerSize,
} from './helpers'
import { normalizeReturns } from '@/lib/utils/returns'

describe('toPositionSeries', () => {
  it('ordena por data, porque a biblioteca rejeita séries fora de ordem', () => {
    const series = toPositionSeries([
      { date: '2026-02-10', price: 12, quantity: 3, average_price: 10 },
      { date: '2026-01-05', price: 11, quantity: 1, average_price: 10 },
    ])

    expect(series.map((p) => p.time)).toEqual(['2026-01-05', '2026-02-10'])
    expect(series[0]).toEqual({ time: '2026-01-05', price: 11, averagePrice: 10, quantity: 1 })
  })

  it('corta a hora, que a biblioteca de gráfico rejeita', () => {
    const series = toPositionSeries([
      { date: '2026-01-05T00:00:00', price: 11, quantity: 1, average_price: 10 },
    ])

    expect(series[0].time).toBe('2026-01-05')
  })

  it('mantém uma entrada por data', () => {
    const series = toPositionSeries([
      { date: '2026-01-05', price: 11, quantity: 1, average_price: 10 },
      { date: '2026-01-05', price: 13, quantity: 2, average_price: 12 },
    ])

    expect(series).toHaveLength(1)
    expect(series[0].price).toBe(13)
  })
})

describe('toDayTrades', () => {
  it('soma as operações do dia e usa a média ponderada de preço', () => {
    const days = toDayTrades([
      { date: '2026-01-05', price: 10, quantity: 1 },
      { date: '2026-01-05', price: 20, quantity: 3 },
    ])

    expect(days).toEqual([{ time: '2026-01-05', quantity: 4, price: 17.5, value: 70 }])
  })

  it('junta datetime e dia puro no mesmo dia', () => {
    const days = toDayTrades([
      { date: '2026-01-05T00:00:00', price: 10, quantity: 1 },
      { date: '2026-01-05', price: 10, quantity: 1 },
    ])

    expect(days).toEqual([{ time: '2026-01-05', quantity: 2, price: 10, value: 20 }])
  })

  it('descarta um dia em que compra e venda se anulam', () => {
    const days = toDayTrades([
      { date: '2026-01-05', price: 10, quantity: 2 },
      { date: '2026-01-05', price: 12, quantity: -2 },
    ])

    expect(days).toEqual([])
  })

  it('lê o dia pelo sinal do saldo', () => {
    const days = toDayTrades([
      { date: '2026-01-05', price: 10, quantity: 1 },
      { date: '2026-01-05', price: 10, quantity: -3 },
    ])

    expect(days[0].quantity).toBe(-2)
  })
})

describe('snapTradesToSeries', () => {
  const times = ['2026-01-05', '2026-01-06', '2026-01-09']
  const trade = (time: string, quantity: number, price = 10) => ({
    time,
    quantity,
    price,
    value: Math.abs(quantity * price),
  })

  it('leva a operação para o primeiro ponto igual ou posterior a ela', () => {
    const snapped = snapTradesToSeries([trade('2026-01-07', 1)], times)

    expect(snapped[0].time).toBe('2026-01-09')
  })

  it('mantém a data quando ela já existe na série', () => {
    const snapped = snapTradesToSeries([trade('2026-01-06', 1)], times)

    expect(snapped[0].time).toBe('2026-01-06')
  })

  it('descarta o que cai depois do último ponto', () => {
    const snapped = snapTradesToSeries([trade('2026-01-06', 1), trade('2026-02-01', 2)], times)

    expect(snapped.map((t) => t.time)).toEqual(['2026-01-06'])
  })

  it('descarta o que aconteceu antes da janela, em vez de empilhar na borda', () => {
    const snapped = snapTradesToSeries(
      [trade('2025-11-30', 1), trade('2025-12-30', 1), trade('2026-01-06', 1)],
      times,
    )

    expect(snapped.map((t) => t.time)).toEqual(['2026-01-06'])
  })

  it('reagrupa duas datas que caem no mesmo ponto da série', () => {
    const snapped = snapTradesToSeries([trade('2026-01-07', 1), trade('2026-01-08', 3)], times)

    expect(snapped).toEqual([{ time: '2026-01-09', quantity: 4, price: 10, value: 40 }])
  })

  it('devolve vazio sem série para ancorar', () => {
    expect(snapTradesToSeries([trade('2026-01-06', 1)], [])).toEqual([])
  })
})

describe('tradeLabel', () => {
  it('traz só o valor: a direção está na cor e no triângulo', () => {
    expect(tradeLabel({ time: '2026-01-05', quantity: 2.5, price: 600, value: 1500 }, 'R$')).toBe(
      'R$ 1,5K',
    )
    expect(tradeLabel({ time: '2026-01-05', quantity: -4, price: 200, value: 800 }, 'R$')).toBe(
      'R$ 800',
    )
  })
})

describe('labelledTrades', () => {
  const trade = (time: string, value: number) => ({ time, quantity: 1, price: value, value })

  it('rotula as maiores operações da janela', () => {
    const labelled = labelledTrades(
      [
        trade('2026-01-01', 100),
        trade('2026-01-02', 900),
        trade('2026-01-03', 500),
        trade('2026-01-04', 50),
      ],
      2,
    )

    expect([...labelled].sort()).toEqual(['2026-01-02', '2026-01-03'])
  })

  it('rotula tudo quando cabe', () => {
    const labelled = labelledTrades([trade('2026-01-01', 100), trade('2026-01-02', 900)], 5)

    expect(labelled.size).toBe(2)
  })

  it('não reordena a lista que recebe', () => {
    const trades = [trade('2026-01-01', 100), trade('2026-01-02', 900)]
    labelledTrades(trades, 1)

    expect(trades.map((t) => t.time)).toEqual(['2026-01-01', '2026-01-02'])
  })
})

describe('rollingCagrSeries', () => {
  it('só começa quando a primeira janela de 12 meses fecha', () => {
    const series = rollingCagrSeries([
      { date: '2025-01-01', value: 300 },
      { date: '2025-06-01', value: 250 },
      { date: '2026-01-01', value: 18 },
      { date: '2026-03-01', value: 20 },
    ])

    // Os dois primeiros pontos anualizam uma janela incompleta — é assim que
    // dois meses de alta viram uma taxa anual de três dígitos.
    expect(series.map((p) => p.time)).toEqual(['2026-01-01', '2026-03-01'])
  })

  it('corta a hora e ordena', () => {
    const series = rollingCagrSeries([
      { date: '2025-01-01T00:00:00', value: 0 },
      { date: '2026-05-01T00:00:00', value: 20 },
      { date: '2026-02-01T00:00:00', value: 18 },
    ])

    expect(series).toEqual([
      { time: '2026-02-01', value: 18 },
      { time: '2026-05-01', value: 20 },
    ])
  })

  it('devolve vazio sem dados', () => {
    expect(rollingCagrSeries([])).toEqual([])
  })
})

describe('abbreviateMoney', () => {
  it('omite os centavos', () => {
    expect(abbreviateMoney(849.67, 'R$')).toBe('R$ 850')
  })

  it('abrevia milhares e milhões', () => {
    expect(abbreviateMoney(1500, 'R$')).toBe('R$ 1,5K')
    expect(abbreviateMoney(48_300, 'R$')).toBe('R$ 48K')
    expect(abbreviateMoney(2_400_000, 'R$')).toBe('R$ 2,4M')
  })

  it('usa o símbolo da moeda corrente', () => {
    expect(abbreviateMoney(1500, 'US$')).toBe('US$ 1,5K')
  })

  it('lê a venda pelo módulo', () => {
    expect(abbreviateMoney(-1500, 'R$')).toBe('R$ 1,5K')
  })
})

describe('tradeMarkerSize', () => {
  it('dá o tamanho máximo à maior operação da janela', () => {
    expect(tradeMarkerSize(1000, 1000)).toBeCloseTo(2.4)
  })

  it('cresce pela raiz, não linearmente', () => {
    // Um quarto do valor é metade do tamanho acima do piso, porque o que o
    // olho compara é a área.
    expect(tradeMarkerSize(250, 1000)).toBeCloseTo(1.6)
  })

  it('mantém um piso para a menor operação continuar visível', () => {
    expect(tradeMarkerSize(0, 1000)).toBeCloseTo(0.8)
  })

  it('não divide por zero sem operações na janela', () => {
    expect(tradeMarkerSize(0, 0)).toBe(1)
  })
})

describe('formatQuantity', () => {
  it('dá casas decimais a uma posição fracionária', () => {
    expect(formatQuantity(0.139341, 0.139341)).toBe('0,139341')
  })

  it('não põe decimal onde a ordem de grandeza não pede', () => {
    expect(formatQuantity(1200, 4800)).toBe('1.200')
  })

  it('usa o mesmo formato em toda a escala, ditado pelo máximo', () => {
    expect(formatQuantity(0.5, 4800)).toBe('1')
    expect(formatQuantity(48.10152, 48.10152)).toBe('48,1')
  })
})

describe('formatMoneyAxis', () => {
  it('tira os centavos onde eles não dizem nada', () => {
    expect(formatMoneyAxis(329_358.66, 'R$', 400_000)).toBe('R$ 329.359')
    expect(formatMoneyAxis(173.4, 'R$', 180)).toBe('R$ 173')
  })

  it('mantém os centavos em um ativo barato, onde eles distinguem marcas', () => {
    expect(formatMoneyAxis(5.3, 'R$', 6)).toBe('R$ 5,30')
  })

  it('acompanha a moeda corrente', () => {
    expect(formatMoneyAxis(173.4, 'US$', 180)).toBe('US$ 173')
  })
})

describe('moneyMinMove', () => {
  it('acompanha a casa decimal do formato', () => {
    expect(moneyMinMove(400_000)).toBe(1)
    expect(moneyMinMove(6)).toBeCloseTo(0.01)
  })
})

describe('quantityMinMove', () => {
  it('acompanha a casa decimal do formato', () => {
    expect(quantityMinMove(4800)).toBe(1)
    expect(quantityMinMove(48)).toBeCloseTo(0.01)
    expect(quantityMinMove(0.139)).toBeCloseTo(0.000001)
  })
})

describe('normalizeReturns', () => {
  const dates = ['2026-01-05', '2026-01-06', '2026-01-07']

  it('rebaseia compondo, e não subtraindo', () => {
    const series = normalizeReturns(
      [
        { date: '2026-01-05', value: 0.1 },
        { date: '2026-01-07', value: 0.32 },
      ],
      dates,
    )

    // (1 + 0,32) / (1 + 0,10) - 1 = 0,20 — uma subtração daria 0,22.
    expect(series[0].value).toBeCloseTo(0)
    expect(series[2].value).toBeCloseTo(0.2)
  })

  it('repete o último valor conhecido em datas sem ponto', () => {
    const series = normalizeReturns(
      [
        { date: '2026-01-05', value: 0 },
        { date: '2026-01-07', value: 0.1 },
      ],
      dates,
    )

    expect(series[1].value).toBeCloseTo(0)
  })

  it('usa como base o último valor antes do início da janela', () => {
    const series = normalizeReturns(
      [
        { date: '2025-12-01', value: 0.5 },
        { date: '2026-01-07', value: 0.8 },
      ],
      dates,
    )

    expect(series[0].value).toBeCloseTo(0)
    expect(series[2].value).toBeCloseTo(0.2)
  })

  it('devolve vazio sem datas', () => {
    expect(normalizeReturns([{ date: '2026-01-05', value: 0.1 }], [])).toEqual([])
  })
})

describe('toWeekFlows', () => {
  // 2026-02-02 é uma segunda; a semana começa no domingo, 2026-02-01.
  const week = '2026-02-01'

  it('soma as operações da semana em um evento só', () => {
    const flows = toWeekFlows([
      { date: '2026-02-02', value: 1000 },
      { date: '2026-02-05T00:00:00', value: 500 },
    ])

    expect(flows).toEqual([
      { time: week, from: week, net: 1500, bought: 1500, sold: 0, count: 2 },
    ])
  })

  it('compensa compra e venda da mesma semana, guardando os dois lados', () => {
    const [flow] = toWeekFlows([
      { date: '2026-02-02', value: 1000 },
      { date: '2026-02-04', value: -800 },
    ])

    expect(flow.net).toBe(200)
    expect(flow.bought).toBe(1000)
    expect(flow.sold).toBe(800)
  })

  it('descarta a semana que se anula: não houve evento na carteira', () => {
    expect(
      toWeekFlows([
        { date: '2026-02-02', value: 1000 },
        { date: '2026-02-04', value: -1000 },
      ]),
    ).toEqual([])
  })

  it('separa semanas diferentes e as devolve em ordem', () => {
    const flows = toWeekFlows([
      { date: '2026-02-10', value: 300 },
      { date: '2026-02-02', value: 100 },
    ])

    expect(flows.map((f) => f.time)).toEqual(['2026-02-01', '2026-02-08'])
  })
})

describe('snapFlowsToSeries', () => {
  const dates = ['2026-02-02', '2026-02-03', '2026-02-09']

  it('leva o domingo de início para o primeiro pregão da semana', () => {
    const flows = snapFlowsToSeries(toWeekFlows([{ date: '2026-02-03', value: 100 }]), dates)

    expect(flows[0].time).toBe('2026-02-02')
    // A semana continua sendo a semana, mesmo desenhada na segunda.
    expect(flows[0].from).toBe('2026-02-01')
  })

  it('junta duas semanas que caem no mesmo ponto, preservando o começo', () => {
    // Buraco na série: nada desenhado entre 09/02 e 20/02, então as duas
    // semanas do intervalo só cabem no mesmo ponto.
    const flows = snapFlowsToSeries(
      toWeekFlows([
        { date: '2026-02-09', value: 100 },
        { date: '2026-02-16', value: 50 },
      ]),
      ['2026-02-02', '2026-02-20'],
    )

    expect(flows).toHaveLength(1)
    expect(flows[0].net).toBe(150)
    expect(flows[0].from).toBe('2026-02-08')
  })

  it('descarta o que aconteceu antes da janela, em vez de empilhar na borda', () => {
    const flows = snapFlowsToSeries(toWeekFlows([{ date: '2025-06-10', value: 100 }]), dates)

    expect(flows).toEqual([])
  })

  it('mantém a semana em que a janela começa, rotulada no domingo anterior', () => {
    // A janela abre na segunda 02/02; a semana dessa operação começa no
    // domingo 01/02, antes do primeiro ponto — e mesmo assim é dela.
    const flows = snapFlowsToSeries(toWeekFlows([{ date: '2026-02-03', value: 100 }]), dates)

    expect(flows).toHaveLength(1)
    expect(flows[0].net).toBe(100)
  })
})

describe('formatWeek', () => {
  it('mostra os sete dias que o marcador representa', () => {
    expect(formatWeek('2026-02-01')).toBe('01/02 a 07/02/2026')
  })
})
