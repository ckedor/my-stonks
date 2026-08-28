import { describe, expect, it } from 'vitest'
import { getLast12MonthDividendStats, groupDividendsByMonthAndYear } from './dividends'

const dividend = (date: string, amount: number) => ({ date, amount })

describe('groupDividendsByMonthAndYear', () => {
  /* O relato que trouxe o teste: "tem proventos em setembro e estamos em
     agosto". Não era a conta — era o gráfico, que desenhava as duas séries
     na mesma cor e sem legenda, então a barra de setembro do ano anterior
     lia-se como deste ano. A conta continua tendo de pôr cada provento no
     mês em que ele caiu, e é isso que esta linha prova. */
  it('põe cada provento no próprio mês e no próprio ano', () => {
    const { currentYear, previousYear, rows } = groupDividendsByMonthAndYear([
      dividend('2026-08-15', 100),
      dividend('2025-09-10', 70),
      dividend('2025-08-10', 30),
    ])

    expect(currentYear).toBe(2026)
    expect(previousYear).toBe(2025)

    const byMonth = Object.fromEntries(rows.map((row) => [row.month, row]))
    const august = byMonth[Object.keys(byMonth)[7]]
    const september = byMonth[Object.keys(byMonth)[8]]

    expect(august['2026']).toBe(100)
    expect(august['2025']).toBe(30)
    // Setembro só tem o ano anterior: é o que a legenda passou a dizer.
    expect(september['2026']).toBeUndefined()
    expect(september['2025']).toBe(70)
  })

  it('soma o que cai no mesmo mês', () => {
    const { rows } = groupDividendsByMonthAndYear([
      dividend('2026-03-01', 10),
      dividend('2026-03-28', 5),
    ])

    expect(rows[2]['2026']).toBe(15)
  })

  /* Doze meses sempre, mesmo vazios: sem eles o eixo encolhe conforme o mês
     em que se está, e dois gráficos lado a lado deixam de ser comparáveis. */
  it('desenha os doze meses mesmo sem provento neles', () => {
    const { rows } = groupDividendsByMonthAndYear([dividend('2026-01-05', 10)])

    expect(rows).toHaveLength(12)
    expect(new Set(rows.map((row) => row.month)).size).toBe(12)
  })

  /* `dayjs().month(n)` parte de hoje: num dia 31, fevereiro e os meses de 30
     dias transbordam para o seguinte e o rótulo sai errado. O rótulo tem de
     sair de uma data no dia 1. */
  it('rotula os doze meses sem repetir, seja qual for o dia de hoje', () => {
    const { rows } = groupDividendsByMonthAndYear([])
    const labels = rows.map((row) => row.month)

    expect(new Set(labels).size).toBe(12)
  })

  /* Uma carteira que parou de receber ainda tem o que mostrar: o par de anos
     sai do dado mais recente, e não do calendário. */
  it('usa o ano do provento mais recente, e não o de hoje', () => {
    const { currentYear, previousYear } = groupDividendsByMonthAndYear([
      dividend('2019-04-01', 10),
      dividend('2020-06-01', 20),
    ])

    expect([currentYear, previousYear]).toEqual([2020, 2019])
  })

  it('ignora o que está fora dos dois anos', () => {
    const { rows } = groupDividendsByMonthAndYear([
      dividend('2026-05-01', 10),
      dividend('2020-05-01', 999),
    ])

    expect(rows[4]['2026']).toBe(10)
    expect(rows[4]['2020']).toBeUndefined()
  })

  it('não inventa ano sem provento nenhum', () => {
    const { rows } = groupDividendsByMonthAndYear([])

    expect(rows.every((row) => Object.keys(row).length === 1)).toBe(true)
  })
})

describe('getLast12MonthDividendStats', () => {
  it('divide por doze mesmo quando só alguns meses receberam', () => {
    const { total, average } = getLast12MonthDividendStats([
      { date: new Date().toISOString().slice(0, 10), amount: 120 },
    ])

    expect(total).toBe(120)
    expect(average).toBe(10)
  })
})
