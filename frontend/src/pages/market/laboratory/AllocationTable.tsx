import {
  AppIconButton,
  AppNumberField,
  AppSimpleTable,
  AppStack,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { DraftLine } from './useLaboratory'

/* A composição da carteira teórica, com os pesos editáveis.
 *
 * A cor não entra aqui: a coluna de peso já é número, e um ponto colorido ao
 * lado do nome faria a linha competir com a pizza, que é onde a cor identifica
 * uma fatia. */

interface Props {
  lines: DraftLine[]
  totalWeight: number
  balanced: boolean
  labelOf: (line: DraftLine) => string
  captionOf: (line: DraftLine) => string | null
  onWeightChange: (key: string, weight: number) => void
  onRemove: (key: string) => void
}

export default function AllocationTable({
  lines,
  totalWeight,
  balanced,
  labelOf,
  captionOf,
  onWeightChange,
  onRemove,
}: Props) {
  const columns: AppSimpleTableColumn<DraftLine>[] = [
    {
      label: 'Linha',
      width: 'clamped',
      sortValue: (line) => labelOf(line),
      render: (line) => {
        const caption = captionOf(line)
        return (
          <>
            <AppText>{labelOf(line)}</AppText>
            {caption && (
              <AppText variant="caption" tone="secondary">
                {caption}
              </AppText>
            )}
          </>
        )
      },
    },
    {
      label: 'Peso',
      align: 'right',
      sortValue: (line) => line.weight,
      render: (line) => (
        <AppNumberField
          label="Peso"
          hideLabel
          value={line.weight}
          onChange={(value) => onWeightChange(line.key, value)}
          suffix="%"
          step={0.5}
          min={0}
          size="xs"
          align="right"
        />
      ),
    },
    {
      label: '',
      align: 'right',
      render: (line) => (
        <AppIconButton
          label={`Remover ${labelOf(line)}`}
          onClick={() => onRemove(line.key)}
        >
          <DeleteOutlineIcon fontSize="small" />
        </AppIconButton>
      ),
    },
  ]

  return (
    <AppStack gap="sm">
      <AppSimpleTable
        rows={lines}
        columns={columns}
        getRowKey={(line) => line.key}
        emptyMessage="Nenhuma linha ainda. Escolha um ativo ou um modelo para começar."
      />
      {/* A soma mora ao pé da lista que ela soma, e não numa faixa no topo da
          tela: é olhando as linhas que alguém percebe qual peso corrigir. */}
      {lines.length > 0 && (
        <AppStack direction="row" justify="between">
          <AppText variant="caption" tone="secondary">
            {balanced
              ? 'Os pesos fecham em 100%.'
              : 'A simulação normaliza para 100%, mantendo a proporção entre as linhas.'}
          </AppText>
          <AppText tone={balanced ? 'success' : 'secondary'}>
            {totalWeight.toFixed(1)}%
          </AppText>
        </AppStack>
      )}
    </AppStack>
  )
}
