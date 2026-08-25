import { useEffect, useRef, useState } from 'react'
import AppColorField from './AppColorField'
import AppStack, { AppStackItem } from './AppStack'
import AppTextField from './AppTextField'

/* Uma cor editável dos dois jeitos: pelo seletor do sistema e pelo hexadecimal
 * escrito à mão. O par existe porque nenhum dos dois basta — o seletor não
 * deixa colar o hex que veio de outro lugar, e o campo de texto não deixa
 * escolher a cor olhando.
 *
 * O seletor só avisa a mudança ao fechar. Enquanto ele está aberto o navegador
 * dispara `change` a cada pixel arrastado, e propagar isso reconstrói o tema
 * inteiro dezenas de vezes por segundo. */

export interface AppHexColorFieldProps {
  label: string
  /** Hexadecimal, `#rrggbb`. */
  value: string
  onChange: (value: string) => void
}

const HEX = /^#[0-9a-fA-F]{3,8}$/

export default function AppHexColorField({ label, value, onChange }: AppHexColorFieldProps) {
  const isHex = HEX.test(value)
  const [pickerColor, setPickerColor] = useState(isHex ? value.slice(0, 7) : '#000000')
  const picking = useRef(false)

  useEffect(() => {
    if (!picking.current) setPickerColor(isHex ? value.slice(0, 7) : '#000000')
  }, [value, isHex])

  return (
    <AppStack direction="row" gap="sm" align="center">
      <AppColorField
        label={label}
        value={pickerColor}
        onFocus={() => {
          picking.current = true
        }}
        onChange={setPickerColor}
        onBlur={() => {
          picking.current = false
          onChange(pickerColor)
        }}
      />
      <AppStackItem>
        <AppTextField label={label} value={value} onChange={onChange} />
      </AppStackItem>
    </AppStack>
  )
}
