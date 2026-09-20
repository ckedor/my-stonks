const CNPJ_DIGITS = 14

export const formatCnpj = (value: string | null | undefined) => {
  if (!value) return '—'
  if (value.length !== CNPJ_DIGITS) return value
  return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}`
}

export const formatDate = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value)) : '—'

export const formatNumber = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('pt-BR', { maximumFractionDigits: digits })

export const orDash = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : String(value)

export const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? '—' : value ? 'Sim' : 'Não'
