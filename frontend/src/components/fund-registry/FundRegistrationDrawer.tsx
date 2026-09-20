import type { FundRegistryClass } from '@/api/fundRegistry'
import { ASSET_TYPES } from '@/constants/assetTypes'
import {
  AppAlert,
  AppButton,
  AppFormDrawer,
  AppSearchField,
  AppSelect,
  AppSimpleTable,
  AppSkeleton,
  AppStack,
  AppText,
  SectionTitle,
} from '@/components/ui'
import {
  useFundRegistryClass,
  useFundRegistrySearch,
  useFundSeriesFiling,
  useRegisterFund,
  useSelectFundSeries,
} from '@/queries/fundRegistry'
import axios from 'axios'
import { useMemo, useState } from 'react'
import { FundRegistryFacts } from './FundRegistryFacts'
import { formatCnpj, formatDate, formatNumber, orDash } from './fundRegistryFormat'

const FI = String(ASSET_TYPES.FI)
const PREV = String(ASSET_TYPES.PREV)
const NO_CHOICE = ''

const errorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback
  const message = error.response?.data?.message
  return typeof message === 'string' ? message : fallback
}

export interface FundRegistrationDrawerProps {
  open: boolean
  onClose: () => void
  onRegistered: (assetId: number) => void | Promise<void>
  /** Admin resolution of legacy FIDCs without a confirmed series. */
  assetId?: number
  initialClassId?: number
  initialAssetType?: string
  initialQuery?: string
}

/* Cadastrar fundo: escolher no cadastro da CVM a unidade que tem valor de
   cota — a classe, uma subclasse dela, ou uma série de um FIDC — e torná-la
   um ativo FI ou PREV. A linha do cadastro não é ativo; só a escolha é. */
export function FundRegistrationDrawer({
  open, onClose, onRegistered, assetId, initialClassId, initialAssetType, initialQuery = '',
}: FundRegistrationDrawerProps) {
  const [query, setQuery] = useState(initialQuery)
  const [classId, setClassId] = useState<number | null>(initialClassId ?? null)
  const [subclassId, setSubclassId] = useState(NO_CHOICE)
  const [series, setSeries] = useState(NO_CHOICE)
  const [assetType, setAssetType] = useState<string | null>(initialAssetType ?? null)
  const [error, setError] = useState<string | null>(null)

  const { classes, searching } = useFundRegistrySearch(query)
  const { detail, loading } = useFundRegistryClass(classId)
  const isFidc = detail?.registry_class.fund?.kind === 'FIDC'
  const { filing, reading, failed } = useFundSeriesFiling(classId, isFidc)
  const register = useRegisterFund()
  const selectSeries = useSelectFundSeries()

  const subclass = detail?.subclasses.find((item) => String(item.id) === subclassId) ?? null
  const effectiveAssetType = assetType ?? (subclass?.pension ? PREV : FI)

  const seriesOptions = useMemo(() => {
    const options = [{ value: NO_CHOICE, label: 'Selecione a série de cotas' }]
    for (const item of detail?.series ?? []) {
      options.push({ value: `id:${item.id}`, label: `${item.name} (já cadastrada)` })
    }
    for (const candidate of filing?.candidates ?? []) {
      const shares = candidate.has_shares
        ? `${formatNumber(candidate.shares, 0)} cotas · ${formatNumber(candidate.share_value, 8)}`
        : 'sem cotas'
      options.push({ value: `label:${candidate.label}`, label: `${candidate.label} — ${shares}` })
    }
    return options
  }, [detail, filing])

  const candidatesWithShares = filing?.candidates.filter((candidate) => candidate.has_shares)
  const effectiveSeries = series || (
    candidatesWithShares?.length === 1 ? `label:${candidatesWithShares[0].label}` : NO_CHOICE
  )

  const alreadyRegistered = detail?.registered_units.find(
    (unit) =>
      (unit.fund_registry_subclass_id ?? null) === (subclass?.id ?? null) &&
      (effectiveSeries.startsWith('id:')
        ? unit.fund_share_series_id === Number(effectiveSeries.slice(3))
        : effectiveSeries === NO_CHOICE && unit.fund_share_series_id === null),
  )

  const reset = () => {
    setClassId(initialClassId ?? null)
    setSubclassId(NO_CHOICE)
    setSeries(NO_CHOICE)
    setAssetType(initialAssetType ?? null)
    setError(null)
  }

  const close = () => {
    reset()
    setQuery('')
    onClose()
  }

  const submit = async () => {
    if (classId === null) return
    setError(null)
    try {
      const choice = {
        series_id: effectiveSeries.startsWith('id:') ? Number(effectiveSeries.slice(3)) : null,
        series_label: effectiveSeries.startsWith('label:') ? effectiveSeries.slice(6) : null,
      }
      const created = assetId
        ? await selectSeries.mutateAsync({ assetId, classId, ...choice })
        : await register.mutateAsync({
            fund_registry_class_id: classId,
            asset_type_id: Number(effectiveAssetType),
            fund_registry_subclass_id: subclass?.id ?? null,
            ...choice,
          })
      await onRegistered(created.id)
      close()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível cadastrar o fundo.'))
    }
  }

  return (
    <AppFormDrawer
      open={open}
      onClose={close}
      title={assetId ? 'Confirmar série do fundo' : 'Buscar fundo por CNPJ'}
      width="lg"
      submitLabel={assetId ? 'Confirmar série' : alreadyRegistered ? 'Usar este fundo' : 'Confirmar fundo'}
      onSubmit={() => void submit()}
      submitDisabled={classId === null || !detail || Boolean(isFidc && !effectiveSeries)}
      submitting={register.isPending || selectSeries.isPending}
      header={
        classId === null ? (
          <AppSearchField
            label="CNPJ ou nome do fundo"
            placeholder="Digite o CNPJ ou o nome"
            icon
            autoFocus
            value={query}
            onChange={setQuery}
          />
        ) : undefined
      }
    >
      {classId === null ? (
        <AppSimpleTable<FundRegistryClass>
          rows={classes}
          getRowKey={(row) => row.id}
          surface="outlined"
          onRowClick={(row) => setClassId(row.id)}
          emptyMessage={
            query.trim().length < 3
              ? 'Digite ao menos três caracteres.'
              : searching
                ? 'Buscando…'
                : 'Nenhuma classe encontrada.'
          }
          columns={[
            {
              label: 'Nome',
              width: 'clamped',
              render: (row) => (
                <AppStack>
                  <AppText variant="bodySmall" weight="strong">
                    {row.name}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    {formatCnpj(row.cnpj)}
                  </AppText>
                </AppStack>
              ),
            },
            { label: 'Tipo', render: (row) => orDash(row.fund?.kind) },
            { label: 'Administrador', width: 'clamped', render: (row) => orDash(row.fund?.administrator_name) },
            { label: 'Gestor', width: 'clamped', render: (row) => orDash(row.fund?.manager_name) },
            { label: 'Situação', render: (row) => orDash(row.status) },
          ]}
        />
      ) : (
        <AppStack gap="md">
          <AppStack direction="row" justify="between" align="center">
            <SectionTitle>{detail?.registry_class.name ?? 'Classe'}</SectionTitle>
            {!initialClassId && (
              <AppButton emphasis="ghost" onClick={reset}>
                Voltar à busca
              </AppButton>
            )}
          </AppStack>

          {loading || !detail ? (
            <AppSkeleton height={240} />
          ) : (
            <>
              <FundRegistryFacts registryClass={detail.registry_class} />

              {!assetId && detail.subclasses.length > 0 && (
                <AppSelect
                  label="Subclasse"
                  size="full"
                  density="comfortable"
                  value={subclassId}
                  onChange={setSubclassId}
                  options={[
                    { value: NO_CHOICE, label: 'A classe, sem subclasse' },
                    ...detail.subclasses.map((item) => ({
                      value: String(item.id),
                      label: `${item.name}${item.pension ? ' · previdenciária' : ''}`,
                    })),
                  ]}
                />
              )}

              {isFidc && (
                <AppStack gap="xs">
                  {reading ? (
                    <AppSkeleton height={56} />
                  ) : (
                    <AppSelect
                      label="Série de cotas"
                      size="full"
                      density="comfortable"
                      value={effectiveSeries}
                      onChange={setSeries}
                      options={seriesOptions}
                    />
                  )}
                  <AppText variant="caption" tone="secondary">
                    {failed
                      ? 'Não foi possível ler os informes da CVM agora.'
                      : filing?.filing_date
                        ? `Séries do informe de ${formatDate(filing.filing_date)}.`
                        : filing
                          ? `Nenhum informe desta classe entre ${formatDate(filing.searched_from)} e ${formatDate(filing.searched_to)}.`
                          : 'Lendo o informe mais recente na CVM…'}
                  </AppText>
                </AppStack>
              )}

              {!assetId && (
                <AppSelect
                  label="Tipo do ativo"
                  size="full"
                  density="comfortable"
                  value={effectiveAssetType}
                  onChange={setAssetType}
                  options={[
                    { value: FI, label: 'FI — Fundo de investimento' },
                    { value: PREV, label: 'PREV — Previdência' },
                  ]}
                />
              )}

              {alreadyRegistered && (
                <AppAlert severity="info">
                  Este fundo já está cadastrado e será reutilizado.
                </AppAlert>
              )}
              {error && <AppAlert severity="error">{error}</AppAlert>}
            </>
          )}
        </AppStack>
      )}
    </AppFormDrawer>
  )
}
