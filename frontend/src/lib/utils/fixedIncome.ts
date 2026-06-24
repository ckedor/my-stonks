type FixedIncomeDescriptionInput = {
  typeName?: string | null
  typeId?: number | null
  indexName?: string | null
  fee?: number | null
}

export function formatFixedIncomeFee(fee?: number | null): string {
  if (fee === null || fee === undefined || Number.isNaN(Number(fee))) return ''

  return `${(Number(fee) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

export function formatFixedIncomeDescription({
  typeName,
  typeId,
  indexName,
  fee,
}: FixedIncomeDescriptionInput): string {
  const rate = formatFixedIncomeFee(fee)
  const type = typeName ?? ''
  const index = indexName ?? ''

  if (typeId === 2 || type === 'Index+') {
    if (index && rate) return `${index} + ${rate}`
    if (index) return index
    if (rate) return `Indexador + ${rate}`
  }

  if (typeId === 3 || type === '%Index') {
    if (index && rate) return `${rate} do ${index}`
    if (rate) return `${rate} do indexador`
    if (index) return index
  }

  if (typeId === 1 || type === 'Prefixado') {
    if (rate) return `Prefixado ${rate}`
    return 'Prefixado'
  }

  return type || [index, rate].filter(Boolean).join(' ')
}
