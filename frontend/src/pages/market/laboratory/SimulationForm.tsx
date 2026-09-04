import type { Frequency } from '@/api/lab'
import type { MarketDataSeriesOption } from '@/api/market'
import {
  AppGrid,
  AppGridItem,
  AppNumberField,
  AppToggleGroup,
  AppSelect,
  AppStack,
  AppText,
  SectionLabel,
} from '@/components/ui'
import type { LabDraft } from './useLaboratory'

/* Os parâmetros da simulação.
 *
 * Aporte e rebalanceamento andam no mesmo calendário e por isso têm a mesma
 * lista de frequências. `Nunca` significa coisas diferentes em cada um, e é o
 * que o texto ao lado explica: sem aporte só o valor inicial trabalha; sem
 * rebalanceamento, quem corrige a carteira são os próprios aportes. */

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'none', label: 'Nunca' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
]

const WINDOW_OPTIONS = [
  { value: '1', label: '1 ano' },
  { value: '5', label: '5 anos' },
  { value: '10', label: '10 anos' },
  { value: 'max', label: 'Máximo' },
]

interface Props {
  draft: LabDraft
  series: MarketDataSeriesOption[]
  onChange: (changes: Partial<LabDraft>) => void
}

export default function SimulationForm({ draft, series, onChange }: Props) {
  const frequencyOptions = FREQUENCY_OPTIONS.map((option) => ({
    value: option.value as string,
    label: option.label,
  }))

  return (
    <AppStack gap="md">
      <AppStack gap="sm">
        <SectionLabel>Janela</SectionLabel>
        <AppToggleGroup
          label="Janela da simulação"
          value={draft.years === null ? 'max' : String(draft.years)}
          onChange={(value) =>
            onChange({ years: value === 'max' ? null : Number(value) })
          }
          options={WINDOW_OPTIONS}
        />
        <AppText variant="caption" tone="secondary">
          A simulação começa no primeiro dia em que toda linha já tem preço.
        </AppText>
      </AppStack>

      <AppGrid cols={{ xs: 1, sm: 2 }} gap="md">
        <AppGridItem>
          <AppNumberField
            label="Valor inicial"
            value={draft.initialAmount}
            onChange={(value) => onChange({ initialAmount: value })}
            prefix="R$"
            step={1000}
            min={0}
            size="full"
            density="comfortable"
          />
        </AppGridItem>
        <AppGridItem>
          <AppNumberField
            label="Aporte"
            value={draft.contributionAmount}
            onChange={(value) => onChange({ contributionAmount: value })}
            prefix="R$"
            step={100}
            min={0}
            size="full"
            density="comfortable"
          />
        </AppGridItem>
        <AppGridItem>
          <AppSelect
            label="Frequência do aporte"
            value={draft.contributionFrequency}
            onChange={(value) => onChange({ contributionFrequency: value as Frequency })}
            options={frequencyOptions}
          />
        </AppGridItem>
        <AppGridItem>
          <AppSelect
            label="Rebalanceamento"
            value={draft.rebalanceFrequency}
            onChange={(value) => onChange({ rebalanceFrequency: value as Frequency })}
            options={frequencyOptions}
          />
        </AppGridItem>
      </AppGrid>

      <AppStack gap="sm">
        <SectionLabel>Comparar com</SectionLabel>
        <AppSelect
          label="Benchmark"
          value={draft.benchmarkIds[0] === undefined ? '' : String(draft.benchmarkIds[0])}
          onChange={(value) => onChange({ benchmarkIds: value ? [Number(value)] : [] })}
          options={[
            { value: '', label: 'Só o CDI' },
            ...series.map((item) => ({
              value: String(item.id),
              label: item.short_name || item.name,
            })),
          ]}
        />
        <AppText variant="caption" tone="secondary">
          O CDI entra sempre: é contra ele que o Sharpe é medido.
        </AppText>
      </AppStack>

      <AppText variant="caption" tone="secondary">
        Nas datas de rebalanceamento pode haver venda, e imposto não é
        considerado. Entre elas, o aporte só compra: ele aproxima a carteira do
        alvo sem desfazer posição.
      </AppText>
    </AppStack>
  )
}
