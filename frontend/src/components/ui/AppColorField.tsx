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
}

export default function AppColorField({ value, onChange, label }: AppColorFieldProps) {
  return (
    <input
      type="color"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{ width: SIZE, height: SIZE, border: 'none', cursor: 'pointer' }}
    />
  )
}
