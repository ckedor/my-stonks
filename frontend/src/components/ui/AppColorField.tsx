/* Escolha de cor.
 *
 * O seletor nativo do sistema, sem moldura de campo: ele já é um quadrado
 * da própria cor, que é a informação inteira. Um rótulo flutuante em volta
 * só diria de novo o que a cor mostra. */

const SIZE = 36

export interface AppColorFieldProps {
  /** Cor em hexadecimal, `#rrggbb`. */
  value: string
  onChange: (value: string) => void
  /** Descrição para leitor de tela — um quadrado colorido não tem nome. */
  label: string
  /** Enquanto o seletor está aberto o navegador dispara `change` a cada
   *  pixel arrastado. Quem precisa reagir só à cor final usa este par para
   *  saber quando ele abriu e quando fechou. */
  onFocus?: () => void
  onBlur?: () => void
}

export default function AppColorField({
  value,
  onChange,
  label,
  onFocus,
  onBlur,
}: AppColorFieldProps) {
  return (
    <input
      type="color"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{ width: SIZE, height: SIZE, border: 'none', cursor: 'pointer' }}
    />
  )
}
