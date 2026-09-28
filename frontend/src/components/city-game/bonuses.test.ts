import { describe, expect, it } from 'vitest'

import type { CategoryReturnEntry, Dividend, PatrimonyEntry } from '@/types'

import {
  CATEGORY_WIN_BONUS_USD, categoryWins, cityBonuses, contributionBonusUsd, monthlyReturns, receivedDividends,
} from './bonuses'

const entry = (date: string, acc_return: number, id = 1, category = 'Ações'): CategoryReturnEntry =>
  ({ date, custom_category_id: id, category, daily_return: 0, acc_return, cagr: null })

const day = (date: string, aported: number): PatrimonyEntry => ({ date, portfolio: 0, aported })

describe('dividendo', () => {
  it('só conta o que já caiu na conta', () => {
    const dividends = [
      { id: 1, date: '2026-09-01', amount: 10 },
      { id: 2, date: '2026-10-15', amount: 99 },
    ] as Dividend[]
    expect(receivedDividends(dividends, '2026-09-28').map(dividend => dividend.id)).toEqual([1])
  })

  it('vale em dobro: o bônus é o mesmo tanto que ele pagou', () => {
    expect(cityBonuses({ dividendsUsd: 300, patrimony: [], wins: [] }).dividendUsd).toBe(300)
  })
})

describe('aporte', () => {
  it('rende um quarto do que entrou, líquido de saques', () => {
    expect(contributionBonusUsd([day('2026-01-02', 1_000), day('2026-02-02', 3_000), day('2026-03-02', -2_000)])).toBe(500)
  })

  it('nunca fica negativo', () => {
    expect(contributionBonusUsd([day('2026-01-02', -5_000)])).toBe(0)
  })
})

describe('categoria contra o benchmark', () => {
  it('lê o retorno de cada mês do fim do mês anterior ao fim do mês', () => {
    const months = monthlyReturns([
      { date: '2026-01-10', value: 0 }, { date: '2026-01-31', value: 0.1 },
      { date: '2026-02-27', value: 0.21 },
    ])
    expect([...months.keys()]).toEqual(['2026-02'])
    expect(months.get('2026-02')).toBeCloseTo(0.1)
  })

  it('premia cada mês fechado em que a categoria rendeu mais', () => {
    const categories = [
      entry('2026-06-30', 0), entry('2026-07-31', 0.05), entry('2026-08-31', 0.05), entry('2026-09-25', 0.2),
    ]
    const cdi = [
      { date: '2026-06-30', value: 0 }, { date: '2026-07-31', value: 0.01 },
      { date: '2026-08-31', value: 0.02 }, { date: '2026-09-25', value: 0.03 },
    ]
    const wins = categoryWins(categories, { CDI: cdi }, new Map(), '2026-09-28')
    // julho venceu, agosto ficou parado e perdeu, setembro ainda não fechou
    expect(wins.map(win => win.month)).toEqual(['2026-07'])
    expect(wins[0].benchmark).toBe('CDI')
    expect(cityBonuses({ dividendsUsd: 0, patrimony: [], wins }).benchmarkUsd).toBe(CATEGORY_WIN_BONUS_USD)
  })

  it('compara com o benchmark escolhido pela categoria', () => {
    const categories = [entry('2026-06-30', 0, 2, 'Exterior'), entry('2026-07-31', 0.02, 2, 'Exterior')]
    const series = {
      CDI: [{ date: '2026-06-30', value: 0 }, { date: '2026-07-31', value: 0.01 }],
      SPX: [{ date: '2026-06-30', value: 0 }, { date: '2026-07-31', value: 0.05 }],
    }
    expect(categoryWins(categories, series, new Map([[2, 'SPX']]), '2026-09-28')).toEqual([])
    expect(categoryWins(categories, series, new Map(), '2026-09-28')).toHaveLength(1)
  })

  it('sem a série do benchmark, não há vitória', () => {
    const categories = [entry('2026-06-30', 0), entry('2026-07-31', 0.5)]
    expect(categoryWins(categories, {}, new Map(), '2026-09-28')).toEqual([])
  })
})
