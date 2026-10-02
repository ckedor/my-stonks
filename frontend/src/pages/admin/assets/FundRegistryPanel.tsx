import {
  AppAlert,
  AppButton,
  AppDateField,
  AppSimpleTable,
  AppSkeleton,
  AppStack,
  AppTextField,
  SectionTitle,
} from '@/components/ui'
import type { FundShareSeriesAlias } from '@/api/fundRegistry'
import { useConfirmFundSeriesAliases, useFundRegistryClass } from '@/queries/fundRegistry'
import axios from 'axios'
import type { Dayjs } from 'dayjs'
import { useState } from 'react'
import { FundRegistrationDrawer } from '@/components/fund-registry/FundRegistrationDrawer'
import { FundRegistryFacts } from '@/components/fund-registry/FundRegistryFacts'
import { formatDate } from '@/components/fund-registry/fundRegistryFormat'

export interface FundRegistryPanelProps {
  assetId: number
  classId: number
  seriesId: number | null
}

/* O cadastro CVM de um fundo já cadastrado, e os rótulos da série dele.

   Um FIDC informa a série com um rótulo que muda ("Série 1" virou
   "Subclasse 1"). A importação não adivinha: um rótulo que ninguém confirmou
   falha o fundo. Aqui se confirma que um rótulo foi esta série, e até quando.
   Os rótulos antigos ficam, para que reler um informe antigo continue
   funcionando. */
export function FundRegistryPanel({ assetId, classId, seriesId }: FundRegistryPanelProps) {
  const { detail, loading } = useFundRegistryClass(classId)
  const confirm = useConfirmFundSeriesAliases(classId)
  const [label, setLabel] = useState('')
  const [validFrom, setValidFrom] = useState<Dayjs | null>(null)
  const [validTo, setValidTo] = useState<Dayjs | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [seriesOpen, setSeriesOpen] = useState(false)

  if (loading || !detail) return <AppSkeleton height={240} />

  const resolvedSeriesId = detail.registered_units.find((unit) => unit.asset_id === assetId)?.fund_share_series_id ?? seriesId
  const series = detail.series.find((item) => item.id === resolvedSeriesId) ?? null

  const submit = async () => {
    setError(null)
    setConfirmed(false)
    try {
      await confirm.mutateAsync({
        assetId,
        aliases: [
          {
            label: label.trim(),
            valid_from: validFrom ? validFrom.format('YYYY-MM-DD') : null,
            valid_to: validTo ? validTo.format('YYYY-MM-DD') : null,
          },
        ],
      })
      setLabel('')
      setValidFrom(null)
      setValidTo(null)
      setConfirmed(true)
    } catch (caught) {
      const message = axios.isAxiosError(caught) ? caught.response?.data?.message : null
      setError(typeof message === 'string' ? message : 'Não foi possível confirmar o rótulo.')
    }
  }

  return (
    <AppStack gap="md">
      <SectionTitle>Cadastro CVM</SectionTitle>
      <FundRegistryFacts registryClass={detail.registry_class} />

      {!series && detail.registry_class.fund?.kind === 'FIDC' && (
        <>
          <AppAlert tone="info">Confirme a série deste fundo para importar suas cotas.</AppAlert>
          <AppButton onClick={() => setSeriesOpen(true)}>Escolher série</AppButton>
          {seriesOpen && <FundRegistrationDrawer
            open
            assetId={assetId}
            initialClassId={classId}
            onClose={() => setSeriesOpen(false)}
            onRegistered={() => setSeriesOpen(false)}
          />}
        </>
      )}

      {series && (
        <AppStack gap="sm">
          <SectionTitle>Série {series.name}</SectionTitle>
          <AppSimpleTable<FundShareSeriesAlias>
            rows={series.aliases}
            getRowKey={(row) => row.id}
            surface="outlined"
            emptyMessage="Nenhum rótulo confirmado."
            columns={[
              { label: 'Rótulo (normalizado)', width: 'clamped', render: (row) => row.label },
              { label: 'Desde', render: (row) => (row.valid_from ? formatDate(row.valid_from) : 'sempre') },
              { label: 'Até', render: (row) => (row.valid_to ? formatDate(row.valid_to) : 'hoje') },
            ]}
          />
          <AppTextField
            label="Rótulo informado pela CVM"
            placeholder="Subclasse Senior Série 1"
            value={label}
            onChange={setLabel}
          />
          <AppStack direction="row" gap="sm" collapseBelow="sm">
            <AppDateField label="Válido desde" value={validFrom} onChange={setValidFrom} />
            <AppDateField label="Válido até" value={validTo} onChange={setValidTo} />
          </AppStack>
          <AppButton
            emphasis="outline"
            onClick={() => void submit()}
            disabled={label.trim() === ''}
            loading={confirm.isPending}
          >
            Confirmar rótulo desta série
          </AppButton>
          {error && <AppAlert tone="danger">{error}</AppAlert>}
          {confirmed && (
            <AppAlert tone="success">
              Rótulo confirmado. A próxima importação de valores de cota relê o histórico deste fundo.
            </AppAlert>
          )}
        </AppStack>
      )}
    </AppStack>
  )
}
