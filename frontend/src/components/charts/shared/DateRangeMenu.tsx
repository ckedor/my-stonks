import { AppInlineToggle } from '@/components/ui'
import { DateRangeKey } from '@/lib/utils/date'

export interface RangeOption {
  label: string
  value: DateRangeKey
}

/** O período que o gráfico mostra. É só o `AppInlineToggle` amarrado às
 *  chaves de período — o que sobrou depois que a aparência virou decisão do
 *  design system. */
export default function DateRangeMenu({
  show,
  range,
  options,
  onChange,
}: {
  show: boolean
  range: DateRangeKey
  options: RangeOption[]
  onChange: (v: DateRangeKey) => void
}) {
  if (!show) return null

  return <AppInlineToggle options={options} value={range} onChange={onChange} />
}
