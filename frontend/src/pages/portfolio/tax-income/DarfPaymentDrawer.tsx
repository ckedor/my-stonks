import type { DarfObligation } from '@/api/incomeTax'
import {
  AppDateField,
  AppFormDrawer,
  AppIconButton,
  AppNumberField,
  AppStack,
  AppText,
  SectionLabel,
} from '@/components/ui'
import { useDeleteDarfPayment, useRegisterDarfPayment } from '@/queries/incomeTax'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { formatDay, formatMonth, formatTaxValue, money } from './format'

/* Registrar o pagamento de um DARF.
 *
 * O principal sugerido é o saldo em aberto; multa e juros entram à parte,
 * como o Sicalc os imprime, e não abatem imposto. Pagamento registrado errado
 * sai daqui mesmo, e a apuração volta a mostrar o DARF em aberto. */

interface Props {
  obligation: DarfObligation
  onClose: () => void
}

const decimal = (value: number) => value.toFixed(2)

export default function DarfPaymentDrawer({ obligation, onClose }: Props) {
  const register = useRegisterDarfPayment()
  const remove = useDeleteDarfPayment()
  const balance = money(obligation.balance)
  const [paidOn, setPaidOn] = useState<Dayjs | null>(dayjs())
  const [principal, setPrincipal] = useState(balance > 0 ? balance : money(obligation.amount))
  const [fine, setFine] = useState(0)
  const [interest, setInterest] = useState(0)

  const valid = paidOn !== null && principal > 0 && fine >= 0 && interest >= 0

  const submit = () => {
    if (!valid || paidOn === null) return
    register.mutate(
      {
        revenue_code: obligation.revenue_code,
        period: obligation.period,
        paid_on: paidOn.format('YYYY-MM-DD'),
        principal: decimal(principal),
        fine: decimal(fine),
        interest: decimal(interest),
      },
      { onSuccess: onClose }
    )
  }

  return (
    <AppFormDrawer
      open
      onClose={onClose}
      title={`DARF ${obligation.revenue_code} · ${formatMonth(obligation.period)}`}
      width="sm"
      submitLabel="Registrar pagamento"
      onSubmit={submit}
      submitDisabled={!valid}
      submitting={register.isPending}
    >
      <AppText variant="bodySmall" tone="secondary">
        {`Valor ${formatTaxValue(obligation.amount)}, vencimento em ${formatDay(obligation.due_date)}.`}
      </AppText>

      {obligation.payments.length > 0 && (
        <AppStack gap="xs">
          <SectionLabel>Pagamentos registrados</SectionLabel>
          {obligation.payments.map((payment) => (
            <AppStack key={payment.id} direction="row" align="center" justify="between">
              <AppText variant="bodySmall">
                {`${formatDay(payment.paid_on)} · ${formatTaxValue(payment.principal)}`}
                {money(payment.fine) + money(payment.interest) > 0
                  ? ` + ${formatTaxValue(money(payment.fine) + money(payment.interest))} de encargos`
                  : ''}
              </AppText>
              <AppIconButton
                label="Remover pagamento"
                tone="danger"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(payment.id, { onSuccess: onClose })}
              >
                <DeleteOutlineIcon fontSize="small" />
              </AppIconButton>
            </AppStack>
          ))}
        </AppStack>
      )}

      <AppDateField
        label="Data do pagamento"
        density="comfortable"
        value={paidOn}
        onChange={setPaidOn}
      />
      <AppNumberField
        label="Principal (R$)"
        size="full"
        density="comfortable"
        step={0.01}
        value={principal}
        onChange={setPrincipal}
        error={principal <= 0}
        helperText={principal <= 0 ? 'O principal pago deve ser maior que zero' : ''}
      />
      <AppNumberField
        label="Multa (R$)"
        size="full"
        density="comfortable"
        step={0.01}
        value={fine}
        onChange={setFine}
      />
      <AppNumberField
        label="Juros (R$)"
        size="full"
        density="comfortable"
        step={0.01}
        value={interest}
        onChange={setInterest}
      />
    </AppFormDrawer>
  )
}
