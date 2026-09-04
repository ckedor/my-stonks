import { Button } from '@mui/material'
import { useId, useRef, useState, type ReactNode } from 'react'
import AppStack from './AppStack'
import AppText from './AppText'

/* Escolha de um arquivo do computador.
 *
 * O `<input type="file">` nativo desenha um botão que nenhum tema alcança e
 * escreve "Nenhum arquivo selecionado" em cima do layout. Ele fica aqui,
 * escondido, e quem aparece é o botão do app — mesma altura, mesmo raio e
 * mesma cor dos outros.
 *
 * O nome do arquivo escolhido fica ao lado do botão porque um seletor de
 * arquivo sem ele não diz o que vai ser enviado: depois do clique a janela
 * do sistema fecha e não sobra nada na tela. */

export interface AppFileFieldProps {
  /** Rótulo do botão — a ação, não o campo: "Escolher relatório". */
  label: string
  /** Filtro do seletor do sistema, no formato do atributo `accept`. */
  accept?: string
  onChange: (file: File | null) => void
  /** Ícone à esquerda do rótulo. */
  icon?: ReactNode
  disabled?: boolean
}

export default function AppFileField({
  label,
  accept,
  onChange,
  icon,
  disabled,
}: AppFileFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <AppStack direction="row" gap="sm" align="center">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          setSelected(file?.name ?? null)
          onChange(file)
          /* Sem isto, escolher o mesmo arquivo de novo depois de um erro não
             dispara `change`, e a tela fica parada sem dizer por quê. */
          event.target.value = ''
        }}
      />
      <Button
        variant="outlined"
        size="medium"
        startIcon={icon}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      {selected && (
        <AppText variant="bodySmall" tone="secondary">
          {selected}
        </AppText>
      )}
    </AppStack>
  )
}
