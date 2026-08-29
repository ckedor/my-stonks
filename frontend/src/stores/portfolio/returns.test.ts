import type { ReturnsEntry } from '@/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { useReturnsStore } from './returns'

/* A mesma série, em arrays diferentes: é assim que o dado chega do
   localStorage, do cache do IndexedDB e da rede na abertura da tela. */
function series(...values: [string, number][]): ReturnsEntry[] {
  return values.map(([date, value]) => ({ date, value }))
}

const CDI = (): ReturnsEntry[] => series(['2026-01-02', 0.01], ['2026-01-03', 0.02])

beforeEach(() => {
  useReturnsStore.setState({
    categoryReturns: {},
    categoryCagr: {},
    assetReturns: {},
    benchmarks: {},
    benchmarkCurrency: null,
    loading: true,
  })
})

describe('setBenchmarks', () => {
  it('preserva a identidade da série quando o conteúdo repete', () => {
    const { setBenchmarks } = useReturnsStore.getState()

    setBenchmarks({ CDI: CDI() }, 'BRL')
    const first = useReturnsStore.getState().benchmarks
    setBenchmarks({ CDI: CDI() }, 'BRL')

    expect(useReturnsStore.getState().benchmarks).toBe(first)
  })

  it('não avisa quem assina o store numa hidratação repetida', () => {
    const { setBenchmarks } = useReturnsStore.getState()
    setBenchmarks({ CDI: CDI() }, 'BRL')

    let notifications = 0
    const unsubscribe = useReturnsStore.subscribe(() => { notifications += 1 })
    setBenchmarks({ CDI: CDI() }, 'BRL')
    unsubscribe()

    expect(notifications).toBe(0)
  })

  it('troca a série quando um valor muda', () => {
    const { setBenchmarks } = useReturnsStore.getState()

    setBenchmarks({ CDI: CDI() }, 'BRL')
    const first = useReturnsStore.getState().benchmarks
    setBenchmarks({ CDI: series(['2026-01-02', 0.01], ['2026-01-03', 0.03]) }, 'BRL')

    expect(useReturnsStore.getState().benchmarks).not.toBe(first)
    expect(useReturnsStore.getState().benchmarks.CDI[1].value).toBe(0.03)
  })

  it('troca a série quando a moeda muda, mesmo com os mesmos números', () => {
    const { setBenchmarks } = useReturnsStore.getState()

    setBenchmarks({ CDI: CDI() }, 'BRL')
    const first = useReturnsStore.getState().benchmarks
    setBenchmarks({ CDI: CDI() }, 'USD')

    expect(useReturnsStore.getState().benchmarks).not.toBe(first)
    expect(useReturnsStore.getState().benchmarkCurrency).toBe('USD')
  })

  it('troca a série quando um benchmark entra ou sai', () => {
    const { setBenchmarks } = useReturnsStore.getState()

    setBenchmarks({ CDI: CDI() }, 'BRL')
    const first = useReturnsStore.getState().benchmarks
    setBenchmarks({ CDI: CDI(), IBOV: CDI() }, 'BRL')

    expect(useReturnsStore.getState().benchmarks).not.toBe(first)
    expect(Object.keys(useReturnsStore.getState().benchmarks)).toEqual(['CDI', 'IBOV'])
  })
})

describe('setPortfolioReturns', () => {
  it('preserva a identidade da série quando o conteúdo repete', () => {
    const { setPortfolioReturns } = useReturnsStore.getState()

    setPortfolioReturns(CDI(), 0.1)
    const first = useReturnsStore.getState().categoryReturns
    setPortfolioReturns(CDI(), 0.1)

    expect(useReturnsStore.getState().categoryReturns).toBe(first)
  })

  it('tira o loading mesmo quando o dado repete', () => {
    const { setPortfolioReturns } = useReturnsStore.getState()

    setPortfolioReturns(CDI(), 0.1)
    useReturnsStore.setState({ loading: true })
    setPortfolioReturns(CDI(), 0.1)

    expect(useReturnsStore.getState().loading).toBe(false)
  })

  it('troca a série quando só o cagr muda', () => {
    const { setPortfolioReturns } = useReturnsStore.getState()

    setPortfolioReturns(CDI(), 0.1)
    setPortfolioReturns(CDI(), 0.2)

    expect(useReturnsStore.getState().categoryCagr.portfolio).toBe(0.2)
  })
})

describe('setAllCategoryReturns', () => {
  it('preserva a identidade das séries quando o conteúdo repete', () => {
    const { setPortfolioReturns, setAllCategoryReturns } = useReturnsStore.getState()
    setPortfolioReturns(CDI(), 0.1)

    setAllCategoryReturns({ FIIs: CDI() }, { FIIs: 0.3 })
    const first = useReturnsStore.getState().categoryReturns
    setAllCategoryReturns({ FIIs: CDI() }, { FIIs: 0.3 })

    expect(useReturnsStore.getState().categoryReturns).toBe(first)
    expect(useReturnsStore.getState().categoryReturns.portfolio).toBeDefined()
  })

  it('troca as séries quando uma categoria muda', () => {
    const { setAllCategoryReturns } = useReturnsStore.getState()

    setAllCategoryReturns({ FIIs: CDI() }, { FIIs: 0.3 })
    const first = useReturnsStore.getState().categoryReturns
    setAllCategoryReturns({ FIIs: CDI(), Ações: CDI() }, { FIIs: 0.3, Ações: 0.4 })

    expect(useReturnsStore.getState().categoryReturns).not.toBe(first)
  })
})
