import { useCurrencyStore } from '@/stores/currency'

export function useCurrency() {
  const currency = useCurrencyStore((s) => s.currency)
  const setCurrency = useCurrencyStore((s) => s.setCurrency)
  const toggleCurrency = useCurrencyStore((s) => s.toggleCurrency)

  const symbol = currency === 'BRL' ? 'R$' : 'US$'
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US'

  const format = (value: number, fractionDigits?: number) =>
    value.toLocaleString(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })

  return { currency, setCurrency, toggleCurrency, symbol, locale, format }
}
