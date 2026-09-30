import type { Money } from '@/api/incomeTax'
import { AppCopyField } from '@/components/ui'
import { formatFormAmount, pasteAmount } from './format'

/** Um campo de valor de uma ficha: "1.234,56" na tela, "1234,56" copiado. */
export default function FormAmount({ label, value }: { label: string; value: Money }) {
  return (
    <AppCopyField label={label} value={formatFormAmount(value)} copyValue={pasteAmount(value)} />
  )
}
