/* Formatadores de exibição das tabelas de market data.
 *
 * Moram fora do `DataTable.tsx` porque o Fast Refresh do Vite só funciona
 * em arquivos que exportam apenas componentes: um helper exportado ao lado
 * do componente derruba o hot reload do módulo inteiro. */

export const formatDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR')

export const formatNumber = (value: number | string | null, digits = 2) => {
  if (value === null || value === undefined || value === '') return '—'
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : '—'
}

/* Preço de mercado, sempre em reais.
 *
 * Não segue o seletor de moeda da carteira de propósito: o que o catálogo
 * devolve é cotação da B3, e convertê-la para dólar diria que o papel é
 * negociado numa moeda em que ele não é. */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatBRL = (value: number | null | undefined) =>
  value == null ? '—' : BRL.format(value)
