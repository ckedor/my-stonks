import { AppSwitch } from '@/components/ui'

/** Liga e desliga na barra de um gráfico. A ordem rótulo-antes-do-controle
 *  virou decisão do `AppSwitch`; aqui sobrou o nome pelo qual os gráficos
 *  já o chamam. */
export default function ToolbarSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return <AppSwitch label={label} checked={checked} onChange={onChange} />
}
