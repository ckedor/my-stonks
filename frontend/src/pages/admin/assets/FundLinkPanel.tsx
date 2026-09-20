import {
  fetchFundLinkSuggestions,
  linkAssetToFundRegistry,
  type FundLinkSuggestion,
  type FundLinkSuggestionReport,
} from '@/api/market'
import {
  AppButton,
  AppCard,
  AppChip,
  AppDivider,
  AppMetric,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import axios from 'axios'
import { useState } from 'react'

/* Ligar cada FII ao fundo que o regulador registrou para ele.
 *
 * O cadastro desses fundos já está no banco — a ingestão semanal do registro da
 * CVM grava FII e ETF junto com todo o resto. O que falta é dizer qual registro
 * é qual ativo, e a CVM não publica código de negociação em arquivo nenhum.
 *
 * Para FII o provedor resolve: ele devolve o CNPJ e o fundo é achado por ele.
 * Cada linha é uma proposta, e confirmar é um clique por ativo — casar fundo
 * por semelhança de nome foi recusado desde o plano do cadastro de fundos.
 *
 * O ETF não aparece aqui: o catálogo de fundos do provedor cobre Fiagro,
 * FI-Infra, FIDC e FIP, e não lista BOVA11 nem IVVB11. Ele é ligado pela busca
 * do registro, na tela do próprio ativo.
 *
 * Um CNPJ que aponta para mais de um registro vem como ambíguo e fica sem
 * botão: escolher por alguém seria adivinhar qual dos dois é o fundo. */

function describeError(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Falha inesperada.'
  const status = error.response?.status
  if (status === 401 || status === 403) return 'Vincular exige um usuário administrador.'
  const payload = error.response?.data as { message?: string } | undefined
  return payload?.message ?? `Erro ${status ?? ''}`.trim()
}

export default function FundLinkPanel({
  onLinked,
  onError,
}: {
  onLinked: (suggestion: FundLinkSuggestion) => void
  onError: (message: string) => void
}) {
  const [report, setReport] = useState<FundLinkSuggestionReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState<number | null>(null)
  const [linked, setLinked] = useState<Set<number>>(new Set())

  const load = async () => {
    setLoading(true)
    try {
      setReport(await fetchFundLinkSuggestions())
      setLinked(new Set())
    } catch (error) {
      onError(describeError(error))
    } finally {
      setLoading(false)
    }
  }

  const confirm = async (suggestion: FundLinkSuggestion) => {
    if (!suggestion.fund_registry_id) return
    setLinking(suggestion.asset_id)
    try {
      await linkAssetToFundRegistry(suggestion.asset_id, suggestion.fund_registry_id)
      setLinked((current) => new Set(current).add(suggestion.asset_id))
      onLinked(suggestion)
    } catch (error) {
      onError(describeError(error))
    } finally {
      setLinking(null)
    }
  }

  const columns: AppSimpleTableColumn<FundLinkSuggestion>[] = [
    {
      label: 'Ticker',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" noWrap>
          {row.ticker}
        </AppText>
      ),
    },
    {
      label: 'CNPJ',
      render: (row) => (
        <AppText variant="bodySmall" noWrap>
          {row.cnpj}
        </AppText>
      ),
    },
    {
      label: 'Fundo no registro',
      render: (row) => (
        <AppText variant="bodySmall" tone="secondary">
          {row.fund_registry_name ?? '—'}
        </AppText>
      ),
    },
    {
      label: '',
      render: (row) =>
        linked.has(row.asset_id) ? (
          <AppChip label="Vinculado" />
        ) : (
          <AppButton
            emphasis="ghost"
            size="sm"
            onClick={() => confirm(row)}
            loading={linking === row.asset_id}
            disabled={linking !== null}
          >
            Confirmar
          </AppButton>
        ),
    },
  ]

  const ambiguousColumns: AppSimpleTableColumn<FundLinkSuggestion>[] = [
    {
      label: 'Ticker',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" noWrap>
          {row.ticker}
        </AppText>
      ),
    },
    {
      label: 'CNPJ',
      render: (row) => (
        <AppText variant="bodySmall" noWrap>
          {row.cnpj}
        </AppText>
      ),
    },
    {
      label: 'Registros com este CNPJ',
      render: (row) => (
        <AppText variant="bodySmall" tone="secondary">
          {(row.candidates ?? []).map((item) => `${item.name} (${item.status ?? '—'})`).join(' · ')}
        </AppText>
      ),
    },
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        <SectionTitle>Vínculo com o cadastro de fundos</SectionTitle>
        <AppText variant="bodySmall" tone="secondary">
          Liga cada FII ao fundo registrado na CVM, de onde vêm o CNPJ, o administrador, o gestor
          e a data de início. O ETF é ligado pela busca do registro, na tela do ativo.
        </AppText>

        <AppStack direction="row" gap="md">
          <AppButton emphasis="ghost" onClick={load} loading={loading} disabled={loading}>
            Buscar propostas
          </AppButton>
        </AppStack>

        {report ? (
          <>
            <AppDivider />
            <AppStack direction="row" gap="lg" wrap>
              <AppMetric label="Propostas" value={String(report.suggestions.length)} />
              <AppMetric label="Ambíguos" value={String(report.ambiguous.length)} />
              <AppMetric label="Sem registro" value={String(report.unknown.length)} />
              <AppMetric label="Já vinculados" value={String(report.already_linked)} />
            </AppStack>

            {report.suggestions.length > 0 ? (
              <AppSimpleTable
                columns={columns}
                rows={report.suggestions}
                getRowKey={(row) => String(row.asset_id)}
              />
            ) : (
              <AppText variant="bodySmall" tone="secondary">
                Nenhuma proposta pendente.
              </AppText>
            )}

            {report.ambiguous.length > 0 ? (
              <AppStack gap="sm">
                <SectionTitle>Ambíguos</SectionTitle>
                <AppText variant="bodySmall" tone="secondary">
                  Mais de um registro carrega este CNPJ. Escolher por você seria adivinhar — o
                  vínculo é feito na tela do ativo.
                </AppText>
                <AppSimpleTable
                  columns={ambiguousColumns}
                  rows={report.ambiguous}
                  getRowKey={(row) => String(row.asset_id)}
                />
              </AppStack>
            ) : null}
          </>
        ) : null}
      </AppStack>
    </AppCard>
  )
}
