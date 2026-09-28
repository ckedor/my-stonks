import { syncCvmRegistry, type CvmRegistrySyncReport } from '@/api/market'
import {
  AppButton,
  AppCard,
  AppDivider,
  AppMetric,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import SyncIcon from '@mui/icons-material/Sync'
import axios from 'axios'
import { useState } from 'react'

/* Casar o cadastro com o que o regulador publica sobre companhias.
 *
 * Duas metades. A primeira preenche as pessoas jurídicas: companhias abertas
 * vêm do cadastro da CVM, e as administradoras vêm do cadastro de fundos que a
 * aplicação já ingere toda semana. A segunda liga a ação à companhia que a
 * emitiu, com a espécie do papel e o segmento de listagem que vêm junto — é o
 * que faz o informe de imposto declarar o CNPJ certo em vez do da corretora.
 *
 * Dois passos como no sync de catálogo, e pela mesma razão: a primeira chamada
 * simula e devolve o relatório, aplicar é a segunda decisão. Aqui pesa ainda
 * mais, porque a rota mexe no CNPJ que vai numa declaração.
 *
 * Ativo de fora da B3 nunca é casado: um arquivo da CVM não descreve uma ação
 * da Nasdaq, e `PNC` é um banco americano aqui e uma companhia que saiu da B3
 * em 1996 lá. A contagem de pulados existe para isso não parecer omissão. */

/** O relatório inteiro travaria a tela: milhares de companhias na primeira
 *  rodada. O começo já diz o que é preciso saber, e o resto é contagem. */
const PREVIEW_ROWS = 50

function describeError(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Falha inesperada ao sincronizar.'
  const status = error.response?.status
  const payload = error.response?.data as { message?: string; detail?: unknown } | undefined
  const detail =
    (typeof payload?.message === 'string' && payload.message) ||
    (typeof payload?.detail === 'string' && payload.detail) ||
    (Array.isArray(payload?.detail) ? JSON.stringify(payload.detail) : null)

  if (status === 401 || status === 403) {
    return 'Sincronizar exige um usuário administrador.'
  }
  if (!status) return `Sem resposta do servidor: ${error.message}`
  return `Erro ${status}${detail ? `: ${detail}` : ''}`
}

function describeChanges(changes: Record<string, [string | null, string | null]>): string {
  return Object.entries(changes)
    .map(([field, [before, after]]) => `${field}: ${before || '—'} → ${after || '—'}`)
    .join(' · ')
}

export default function CvmRegistrySync({
  onApplied,
  onError,
}: {
  onApplied: (report: CvmRegistrySyncReport) => void
  onError: (message: string) => void
}) {
  const [report, setReport] = useState<CvmRegistrySyncReport | null>(null)
  const [running, setRunning] = useState<'preview' | 'apply' | null>(null)

  const run = async (dryRun: boolean) => {
    setRunning(dryRun ? 'preview' : 'apply')
    try {
      const result = await syncCvmRegistry(dryRun)
      setReport(result)
      if (!dryRun) onApplied(result)
    } catch (error) {
      onError(describeError(error))
    } finally {
      setRunning(null)
    }
  }

  const institutionColumns: AppSimpleTableColumn<
    CvmRegistrySyncReport['institutions']['updated'][number]
  >[] = [
    {
      label: 'CNPJ',
      render: (row) => (
        <AppText variant="bodySmall" noWrap>
          {row.cnpj ?? '—'}
        </AppText>
      ),
    },
    {
      label: 'Nome',
      render: (row) => <AppText variant="bodySmall">{row.name ?? '—'}</AppText>,
    },
    {
      label: 'O que muda',
      render: (row) => (
        <AppText variant="bodySmall" tone="secondary">
          {describeChanges(row.changes)}
        </AppText>
      ),
    },
  ]

  const assetColumns: AppSimpleTableColumn<CvmRegistrySyncReport['assets']['updated'][number]>[] = [
    {
      label: 'Ticker',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" noWrap>
          {row.ticker ?? '—'}
        </AppText>
      ),
    },
    {
      label: 'O que muda',
      render: (row) => (
        <AppText variant="bodySmall" tone="secondary">
          {describeChanges(row.changes)}
        </AppText>
      ),
    },
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        <SectionTitle>Cadastro do regulador</SectionTitle>
        <AppText variant="bodySmall" tone="secondary">
          Traz as companhias abertas da CVM, liga cada ação à que a emitiu e preenche a espécie
          do papel e o segmento de listagem.
        </AppText>

        <AppStack direction="row" gap="md">
          <AppButton
            emphasis="ghost"
            icon={<SyncIcon />}
            onClick={() => run(true)}
            loading={running === 'preview'}
            disabled={running !== null}
          >
            Simular
          </AppButton>
          <AppButton
            onClick={() => run(false)}
            loading={running === 'apply'}
            disabled={running !== null || report === null}
          >
            Aplicar
          </AppButton>
        </AppStack>

        {report ? (
          <>
            <AppDivider />
            <AppStack direction="row" gap="lg" wrap>
              <AppMetric
                label="Pessoas jurídicas novas"
                value={String(report.institutions.created.length)}
              />
              <AppMetric
                label="Pessoas jurídicas corrigidas"
                value={String(report.institutions.updated.length)}
              />
              <AppMetric label="Ações corrigidas" value={String(report.assets.updated.length)} />
              <AppMetric
                label="Ações sem correspondência"
                value={String(report.assets.unmatched.length)}
              />
              <AppMetric
                label="Estrangeiras puladas"
                value={String(report.assets.skipped_foreign)}
              />
            </AppStack>

            {report.assets.updated.length > 0 ? (
              <AppStack gap="sm">
                <SectionTitle>Ações</SectionTitle>
                <AppSimpleTable
                  columns={assetColumns}
                  rows={report.assets.updated.slice(0, PREVIEW_ROWS)}
                  getRowKey={(row) => row.ticker ?? ''}
                />
              </AppStack>
            ) : null}

            {report.institutions.updated.length > 0 ? (
              <AppStack gap="sm">
                <SectionTitle>Pessoas jurídicas corrigidas</SectionTitle>
                <AppSimpleTable
                  columns={institutionColumns}
                  rows={report.institutions.updated.slice(0, PREVIEW_ROWS)}
                  getRowKey={(row) => row.cnpj ?? ''}
                />
              </AppStack>
            ) : null}

            <AppText variant="caption" tone="secondary">
              {report.dry_run
                ? 'Simulação: nada foi gravado.'
                : 'Aplicado. As pessoas jurídicas e os vínculos estão no banco.'}
            </AppText>
          </>
        ) : null}
      </AppStack>
    </AppCard>
  )
}
