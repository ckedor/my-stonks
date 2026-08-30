import { syncAssetCatalogue, type AssetSyncReport } from '@/api/market'
import {
  AppButton,
  AppCard,
  AppChip,
  AppDivider,
  AppMetric,
  AppSelect,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import SyncIcon from '@mui/icons-material/Sync'
import axios from 'axios'
import { useState } from 'react'

/* Casar o cadastro de ativos com o catálogo do provedor, à mão.
 *
 * A rota é um merge: ticker nos dois lados recebe nome e logo do provedor,
 * ticker só no catálogo vira ativo novo, e ticker só no cadastro fica como
 * está — renda fixa e tesouro não estão em catálogo nenhum e carregam
 * histórico de carteira.
 *
 * Dois passos, e não um botão só: a primeira chamada é uma simulação e devolve
 * o relatório do que mudaria; aplicar é uma segunda decisão, tomada depois de
 * ler o relatório. A rota reescreve nomes que as telas mostram e pode cadastrar
 * o mercado inteiro de uma classe — não é o tipo de coisa que se dispara sem
 * ver antes. */

const KIND_OPTIONS = [
  { value: 'default', label: 'Ações, ETFs, FIIs, BDRs e Fundos' },
  { value: 'stock', label: 'Somente ações' },
  { value: 'etf', label: 'Somente ETFs' },
  { value: 'fii', label: 'Somente FIIs' },
  { value: 'bdr', label: 'Somente BDRs' },
  { value: 'fi', label: 'Somente fundos de investimento' },
  { value: 'crypto', label: 'Somente cripto' },
]

/** O relatório inteiro numa tabela travaria a tela num sync de mercado
 *  inteiro: o começo já diz o que é preciso saber, e o resto é contagem. */
const PREVIEW_ROWS = 50

const KIND_LABEL: Record<string, string> = {
  stock: 'Ação',
  etf: 'ETF',
  fii: 'FII',
  bdr: 'BDR',
  fi: 'Fundo',
  crypto: 'Cripto',
}

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

export default function AssetCatalogueSync({
  onApplied,
  onError,
}: {
  /** Chamado depois de uma aplicação bem-sucedida, para a página reler a lista. */
  onApplied: (report: AssetSyncReport) => void
  onError: (message: string) => void
}) {
  const [scope, setScope] = useState('default')
  const [report, setReport] = useState<AssetSyncReport | null>(null)
  const [running, setRunning] = useState<'preview' | 'apply' | null>(null)

  const kinds = scope === 'default' ? undefined : [scope]

  const run = async (dryRun: boolean) => {
    setRunning(dryRun ? 'preview' : 'apply')
    try {
      const result = await syncAssetCatalogue(kinds, dryRun)
      setReport(result)
      if (!dryRun) onApplied(result)
    } catch (error) {
      /* O erro do servidor, e não uma frase genérica: 403 (só superusuário),
         limite do provedor e falha de escrita são problemas diferentes, e a
         mensagem que os cobria todos não dizia qual deles aconteceu. */
      onError(describeError(error))
    } finally {
      setRunning(null)
    }
  }

  const updatedColumns: AppSimpleTableColumn<AssetSyncReport['updated'][number]>[] = [
    {
      label: 'Ticker',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" noWrap>
          {row.ticker}
        </AppText>
      ),
    },
    {
      label: 'Classe',
      render: (row) => <AppChip label={KIND_LABEL[row.kind] ?? row.kind} />,
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

  const createdColumns: AppSimpleTableColumn<AssetSyncReport['created'][number]>[] = [
    {
      label: 'Ticker',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" noWrap>
          {row.ticker ?? '—'}
        </AppText>
      ),
    },
    {
      label: 'Classe',
      render: (row) => <AppChip label={KIND_LABEL[row.kind] ?? row.kind} />,
    },
    {
      label: 'Nome',
      render: (row) => (
        <AppText variant="bodySmall" tone="secondary">
          {row.name}
        </AppText>
      ),
    },
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" justify="between" align="end" wrap>
          <AppStack gap="xs">
            <SectionTitle>Sincronizar com o catálogo</SectionTitle>
            <AppText variant="bodySmall" tone="secondary">
              Corrige nome e logo pelo provedor, cadastra o que falta e não mexe no que só
              existe aqui. A simulação não escreve nada.
            </AppText>
          </AppStack>

          <AppStack direction="row" gap="md" align="end" wrap>
            <AppSelect label="Catálogos" options={KIND_OPTIONS} value={scope} onChange={setScope} />
            <AppButton
              icon={<SyncIcon />}
              loading={running === 'preview'}
              onClick={() => run(true)}
            >
              Simular
            </AppButton>
            <AppButton
              tone="danger"
              loading={running === 'apply'}
              disabled={!report || !report.dry_run}
              onClick={() => run(false)}
            >
              Aplicar
            </AppButton>
          </AppStack>
        </AppStack>

        {report && (
          <>
            <AppDivider />

            <AppStack direction="row" gap="lg" wrap>
              <AppMetric label="A cadastrar" value={String(report.created.length)} />
              <AppMetric label="A corrigir" value={String(report.updated.length)} />
              <AppMetric label="Sem mudança" value={String(report.unchanged)} />
              <AppMetric label="Só no cadastro" value={String(report.kept_local.length)} />
            </AppStack>

            <AppText variant="bodySmall" tone={report.dry_run ? 'caution' : 'success'}>
              {report.dry_run
                ? 'Simulação: nada foi escrito. Aplicar executa exatamente isto.'
                : 'Aplicado.'}
            </AppText>

            {report.updated.length > 0 && (
              <AppStack gap="sm">
                <SectionTitle>Correções</SectionTitle>
                <AppSimpleTable
                  rows={report.updated.slice(0, PREVIEW_ROWS)}
                  columns={updatedColumns}
                  getRowKey={(row) => `${row.kind}:${row.ticker}`}
                  surface="outlined"
                />
                {report.updated.length > PREVIEW_ROWS && (
                  <AppText variant="caption" tone="secondary">
                    e mais {report.updated.length - PREVIEW_ROWS}
                  </AppText>
                )}
              </AppStack>
            )}

            {report.created.length > 0 && (
              <AppStack gap="sm">
                <SectionTitle>Novos ativos</SectionTitle>
                <AppSimpleTable
                  rows={report.created.slice(0, PREVIEW_ROWS)}
                  columns={createdColumns}
                  getRowKey={(row) => `${row.kind}:${row.ticker}`}
                  surface="outlined"
                />
                {report.created.length > PREVIEW_ROWS && (
                  <AppText variant="caption" tone="secondary">
                    e mais {report.created.length - PREVIEW_ROWS}
                  </AppText>
                )}
              </AppStack>
            )}
          </>
        )}
      </AppStack>
    </AppCard>
  )
}
