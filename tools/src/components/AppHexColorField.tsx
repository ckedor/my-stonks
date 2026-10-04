import { useEffect, useRef, useState } from 'react'
import { AppColorField, AppStack, AppStackItem, AppTextField } from '@/components/ui'

/* Uma cor editável dos dois jeitos: pelo seletor do sistema e pelo hexadecimal
 * escrito à mão. O par existe porque nenhum dos dois basta — o seletor não
 * deixa colar o hex que veio de outro lugar, e o campo de texto não deixa
 * escolher a cor olhando.
 *
 * Enquanto o seletor está aberto o navegador dispara `change` a cada pixel
 * arrastado. Propagar cada um reconstrói o tema inteiro dezenas de vezes por
 * segundo; não propagar nenhum esconde a cor até o seletor fechar, e escolher
 * olhando o resultado é o motivo de existir o seletor. Então a cor sai no
 * máximo a cada `LIVE_INTERVAL_MS` durante o arraste, e a final sai ao
 * fechar. */

const HEX = /^#[0-9a-fA-F]{3,8}$/

/** O intervalo entre duas cores propagadas enquanto se arrasta. */
const LIVE_INTERVAL_MS = 100

export interface AppHexColorFieldProps {
  label: string
  /** Hexadecimal, `#rrggbb`. */
  value: string
  onChange: (value: string) => void
}

export default function AppHexColorField({ label, value, onChange }: AppHexColorFieldProps) {
  const isHex = HEX.test(value)
  const [pickerColor, setPickerColor] = useState(isHex ? value.slice(0, 7) : '#000000')
  const picking = useRef(false)
  // Abrir e fechar o seletor sem arrastar não é escolher: o fechamento não
  // pode devolver uma cor por cima do hex que acabou de ser escrito.
  const picked = useRef(false)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(pickerColor)
  // O temporizador dispara depois do render que o agendou: chamar o
  // `onChange` daquele render escreveria sobre um rascunho já velho.
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!picking.current) setPickerColor(isHex ? value.slice(0, 7) : '#000000')
  }, [value, isHex])

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current)
    },
    [],
  )

  const pick = (color: string) => {
    setPickerColor(color)
    latest.current = color
    picked.current = true
    if (pending.current) return
    pending.current = setTimeout(() => {
      pending.current = null
      onChangeRef.current(latest.current)
    }, LIVE_INTERVAL_MS)
  }

  return (
    <AppStack direction="row" gap="sm" align="center">
      <AppColorField
        label={label}
        value={pickerColor}
        onFocus={() => {
          picking.current = true
          picked.current = false
        }}
        onChange={pick}
        onBlur={() => {
          picking.current = false
          if (pending.current) clearTimeout(pending.current)
          pending.current = null
          if (picked.current) onChange(latest.current)
        }}
      />
      <AppStackItem>
        <AppTextField label={label} value={value} onChange={onChange} />
      </AppStackItem>
    </AppStack>
  )
}
