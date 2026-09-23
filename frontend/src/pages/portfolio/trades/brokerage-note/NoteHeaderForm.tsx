import type { Broker, DraftNote, NoteAmounts, NoteCurrency, NoteHeader } from '@/api/brokerageNote'
import {
  AppAlert,
  AppChip,
  AppDayField,
  AppGrid,
  AppGridItem,
  AppNumberField,
  AppSelect,
  AppStack,
  AppText,
  AppTextField,
  SectionLabel,
} from '@/components/ui'
import { formatDate } from '@/lib/utils/format'

interface NoteHeaderFormProps {
  note: DraftNote
  header: NoteHeader
  brokers: Broker[]
  onChange: (header: NoteHeader) => void
}

const CURRENCY_OPTIONS = [
  { value: 'BRL', label: 'Real (BRL)' },
  { value: 'USD', label: 'Dólar (USD)' },
]

const TOTAL_FIELDS: [keyof NoteAmounts, string][] = [
  ['purchases_total', 'Compras'],
  ['sales_total', 'Vendas'],
  ['operations_total', 'Valor das operações'],
  ['net_amount', 'Líquido'],
]

const COST_FIELDS: [keyof NoteAmounts, string][] = [
  ['settlement_fee', 'Taxa de liquidação'],
  ['registration_fee', 'Taxa de registro'],
  ['emoluments', 'Emolumentos'],
  ['other_exchange_fees', 'Termo/opções e ANA'],
  ['brokerage', 'Corretagem'],
  ['iss', 'ISS'],
  ['other_costs', 'Outros'],
  ['withheld_income_tax', 'IRRF'],
]

/* O cabeçalho da nota, editável: é o que vai para o histórico.
 *
 * Os avisos são da leitura — a aplicação somou o que o modelo leu contra os
 * totais da própria nota. Eles dizem onde conferir, não o que está certo. */
export default function NoteHeaderForm({ note, header, brokers, onChange }: NoteHeaderFormProps) {
  const set = (patch: Partial<NoteHeader>) => onChange({ ...header, ...patch })
  const setAmount = (field: keyof NoteAmounts, value: number | null) =>
    set({ amounts: { ...header.amounts, [field]: value } })

  const brokerOptions = [
    { value: '', label: 'Escolher corretora' },
    ...brokers.map((broker) => ({ value: String(broker.id), label: broker.name })),
  ]
  const warnings = note.warnings.filter(
    (warning) => header.broker_id === null || !warning.code.startsWith('broker_')
  )

  const amountField = ([field, label]: [keyof NoteAmounts, string]) => (
    <AppGridItem key={field}>
      <AppNumberField
        allowEmpty
        label={label}
        value={header.amounts[field]}
        onChange={(value) => setAmount(field, value)}
        min={field === 'net_amount' ? -1e12 : 0}
        step={0.01}
        size="full"
        align="right"
      />
    </AppGridItem>
  )

  return (
    <AppStack gap="md">
      <AppStack direction="row" justify="between" align="center" gap="md" wrap>
        <AppStack gap="xs">
          <AppText weight="strong">
            {note.note_number ? `Nota ${note.note_number}` : 'Nota sem número'} · pregão{' '}
            {formatDate(note.trade_date)}
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            Como impressa: {note.broker_name}
            {note.broker_cnpj ? ` · CNPJ ${note.broker_cnpj}` : ''}
          </AppText>
        </AppStack>
        {note.imported_at && (
          <AppChip label={`Já importada em ${formatDate(note.imported_at)}`} tone="info" />
        )}
      </AppStack>

      {warnings.map((warning) => (
        <AppAlert key={`${warning.code}-${warning.message}`} severity="error">
          {warning.message}
        </AppAlert>
      ))}

      <AppGrid cols={{ xs: 1, sm: 2, md: 5 }} gap="md">
        <AppGridItem>
          <AppSelect
            label="Corretora"
            options={brokerOptions}
            value={header.broker_id === null ? '' : String(header.broker_id)}
            onChange={(value) => set({ broker_id: value ? Number(value) : null })}
            size="full"
            density="comfortable"
          />
        </AppGridItem>
        <AppGridItem>
          <AppSelect
            label="Moeda"
            options={CURRENCY_OPTIONS}
            value={header.currency}
            onChange={(value) => set({ currency: value as NoteCurrency })}
            size="full"
            density="comfortable"
          />
        </AppGridItem>
        <AppGridItem>
          <AppTextField
            label="Número da nota"
            value={header.note_number ?? ''}
            onChange={(value) => set({ note_number: value.trim() || null })}
          />
        </AppGridItem>
        <AppGridItem>
          <AppDayField
            label="Pregão"
            value={header.trade_date}
            onChange={(value) => value && set({ trade_date: value })}
          />
        </AppGridItem>
        <AppGridItem>
          <AppDayField
            label="Liquidação"
            value={header.settlement_date ?? ''}
            onChange={(value) => set({ settlement_date: value || null })}
          />
        </AppGridItem>
      </AppGrid>

      <SectionLabel>Totais</SectionLabel>
      <AppGrid cols={{ xs: 2, md: 4 }} gap="md">
        {TOTAL_FIELDS.map(amountField)}
      </AppGrid>

      <SectionLabel>Custos e IRRF da nota</SectionLabel>
      <AppGrid cols={{ xs: 2, md: 4 }} gap="md">
        {COST_FIELDS.map(amountField)}
      </AppGrid>
    </AppStack>
  )
}
