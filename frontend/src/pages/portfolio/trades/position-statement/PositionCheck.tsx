import type {
  PositionDiff,
  PositionStatementDraft,
  StatementHolding,
} from '@/api/positionStatement'
import TradeForm from '@/components/TradeForm'
import {
  AppAlert,
  AppButton,
  AppCard,
  AppDayField,
  AppFileField,
  AppGrid,
  AppGridItem,
  AppMetric,
  AppSelect,
  AppSnackbar,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import { useAssets } from '@/queries/assets'
import { useBrokers } from '@/queries/brokerageNote'
import { EMPTY_LIST } from '@/queries/empty'
import { useRefreshPortfolio, useSelectedPortfolioId, useTrades } from '@/queries/portfolio'
import { useComparePositions, useExtractPositionStatement } from '@/queries/positionStatement'
import type { Trade } from '@/types'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useEffect, useMemo, useRef, useState } from 'react'
import AssetTrades from './AssetTrades'
import DiffTable from './DiffTable'
import HoldingsTable from './HoldingsTable'
import { initialHoldings, tradesOf, updateHolding } from './check'

/** Espera depois da última edição antes de comparar de novo. */
const RECOMPARE_DELAY_MS = 500

function errorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: string } } })?.response
  return response?.data?.message ?? fallback
}

type Notice = { message: string; tone: 'success' | 'danger' | 'info' }

/* Aba "Bater posição" de Trades.
 *
 * O extrato de uma corretora — Nubank, BTG, Avenue — contra as operações da
 * carteira naquela corretora. Nada é gravado: o que sai daqui é um
 * diagnóstico, e a correção é editar as operações do ativo que diverge. Cada
 * correção, no extrato ou no histórico, refaz a conferência. */
export default function PositionCheck() {
  const portfolioId = useSelectedPortfolioId()
  const { assets } = useAssets()
  const { brokers } = useBrokers()
  const { data: tradesData } = useTrades()
  const trades = tradesData ?? EMPTY_LIST
  const refreshPortfolio = useRefreshPortfolio()

  const extraction = useExtractPositionStatement()
  const comparison = useComparePositions()

  const [file, setFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<PositionStatementDraft | null>(null)
  const [brokerId, setBrokerId] = useState<number | null>(null)
  const [asOf, setAsOf] = useState('')
  const [holdings, setHoldings] = useState<StatementHolding[]>([])
  const [positions, setPositions] = useState<PositionDiff[]>([])
  // Sobe a cada operação editada: o histórico mudou, e a conferência também.
  const [version, setVersion] = useState(0)
  const [comparedKey, setComparedKey] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ trade?: Trade; assetId?: number } | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const compareKey = JSON.stringify({ brokerId, asOf, holdings, version })
  const compare = useRef(comparison.mutate)
  compare.current = comparison.mutate

  useEffect(() => {
    if (!draft || portfolioId == null || brokerId === null || !asOf) return
    if (compareKey === comparedKey) return
    const timer = setTimeout(() => {
      compare.current(
        { portfolioId, brokerId, asOf, holdings },
        {
          onSuccess: (next) => {
            setPositions(next)
            setComparedKey(compareKey)
          },
          onError: (error) =>
            setNotice({
              message: errorMessage(error, 'Não foi possível comparar a posição'),
              tone: 'danger',
            }),
        }
      )
    }, RECOMPARE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, portfolioId, brokerId, asOf, holdings, compareKey, comparedKey])

  const handleExtract = () => {
    if (!file || portfolioId == null) return
    extraction.mutate(
      { portfolioId, file },
      {
        onSuccess: (read) => {
          const nextHoldings = initialHoldings(read)
          setDraft(read)
          setBrokerId(read.broker_id)
          setAsOf(read.as_of)
          setHoldings(nextHoldings)
          setPositions(read.positions)
          setSelectedAssetId(null)
          // O diagnóstico que veio com a leitura já é o destas entradas.
          setComparedKey(
            JSON.stringify({
              brokerId: read.broker_id,
              asOf: read.as_of,
              holdings: nextHoldings,
              version,
            })
          )
        },
        onError: (error) =>
          setNotice({
            message: errorMessage(error, 'Não foi possível ler o extrato'),
            tone: 'danger',
          }),
      }
    )
  }

  const counts = useMemo(() => {
    const byStatus = {
      match: 0,
      different: 0,
      missing_in_app: 0,
      missing_in_statement: 0,
      unresolved: 0,
    }
    for (const diff of positions) byStatus[diff.status] += 1
    return byStatus
  }, [positions])

  const selectedTrades = useMemo(
    () =>
      selectedAssetId === null || brokerId === null
        ? []
        : tradesOf(trades, selectedAssetId, brokerId, asOf),
    [trades, selectedAssetId, brokerId, asOf]
  )
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId)
  const brokerName = brokers.find((broker) => broker.id === brokerId)?.name ?? 'corretora'
  const stale = compareKey !== comparedKey

  const brokerOptions = [
    { value: '', label: 'Escolher corretora' },
    ...brokers.map((broker) => ({ value: String(broker.id), label: broker.name })),
  ]
  const warnings = (draft?.warnings ?? []).filter(
    (warning) => brokerId === null || warning.code !== 'broker_unknown'
  )

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack gap="md">
          <AppText variant="bodySmall" tone="secondary">
            Extrato de posição em PDF, de qualquer corretora. O modelo lê o que está em custódia; a
            aplicação compara, ativo por ativo, com a soma das operações da carteira naquela
            corretora até a data do extrato. Nada é gravado.
          </AppText>
          <AppStack direction="row" gap="sm" align="center" wrap>
            <AppFileField
              label="Escolher PDF"
              accept="application/pdf"
              icon={<UploadFileIcon fontSize="small" />}
              onChange={setFile}
              disabled={extraction.isPending}
            />
            <AppButton
              onClick={handleExtract}
              disabled={!file || portfolioId == null}
              loading={extraction.isPending}
            >
              Ler extrato
            </AppButton>
          </AppStack>
        </AppStack>
      </AppCard>

      {draft && (
        <>
          <AppStack gap="md">
            <SectionTitle>Extrato</SectionTitle>
            <AppCard>
              <AppStack gap="md">
                <AppText variant="bodySmall" tone="secondary">
                  Como impresso: {draft.broker_name}
                  {draft.broker_cnpj ? ` · CNPJ ${draft.broker_cnpj}` : ''} · {draft.currency}
                </AppText>
                {warnings.map((warning) => (
                  <AppAlert key={warning.code} tone="danger">
                    {warning.message}
                  </AppAlert>
                ))}
                <AppGrid cols={{ xs: 1, sm: 2, md: 4 }} gap="md">
                  <AppGridItem>
                    <AppSelect
                      label="Corretora"
                      options={brokerOptions}
                      value={brokerId === null ? '' : String(brokerId)}
                      onChange={(value) => setBrokerId(value ? Number(value) : null)}
                      size="full"
                      density="comfortable"
                    />
                  </AppGridItem>
                  <AppGridItem>
                    <AppDayField label="Posição em" value={asOf} onChange={setAsOf} />
                  </AppGridItem>
                </AppGrid>
                <SectionLabel>Posições no extrato</SectionLabel>
                <HoldingsTable
                  holdings={holdings}
                  assets={assets}
                  onChange={(index, patch) =>
                    setHoldings((current) => updateHolding(current, index, patch))
                  }
                />
              </AppStack>
            </AppCard>
          </AppStack>

          <AppStack gap="md">
            <SectionTitle>Diagnóstico</SectionTitle>
            <AppCard>
              <AppStack gap="md">
                <AppGrid cols={{ xs: 2, md: 5 }} gap="md">
                  <AppGridItem>
                    <AppMetric label="Iguais" value={String(counts.match)} />
                  </AppGridItem>
                  <AppGridItem>
                    <AppMetric
                      label="Divergem"
                      value={String(counts.different)}
                      tone={counts.different ? 'danger' : 'default'}
                    />
                  </AppGridItem>
                  <AppGridItem>
                    <AppMetric label="Só no extrato" value={String(counts.missing_in_app)} />
                  </AppGridItem>
                  <AppGridItem>
                    <AppMetric label="Só no app" value={String(counts.missing_in_statement)} />
                  </AppGridItem>
                  <AppGridItem>
                    <AppMetric label="Sem ativo" value={String(counts.unresolved)} />
                  </AppGridItem>
                </AppGrid>
                {brokerId === null ? (
                  <AppText variant="bodySmall" tone="secondary">
                    Escolha a corretora para comparar.
                  </AppText>
                ) : (
                  <>
                    {stale && (
                      <AppText variant="bodySmall" tone="secondary">
                        Comparando…
                      </AppText>
                    )}
                    <DiffTable
                      positions={positions}
                      holdings={holdings}
                      assets={assets}
                      selectedAssetId={selectedAssetId}
                      onSelect={setSelectedAssetId}
                    />
                  </>
                )}
              </AppStack>
            </AppCard>
          </AppStack>

          {selectedAssetId !== null && brokerId !== null && (
            <AppStack gap="md">
              <AppStack direction="row" justify="between" align="center" wrap gap="md">
                <SectionTitle>
                  {`Operações de ${selectedAsset?.ticker ?? selectedAsset?.name ?? 'ativo'} na ${brokerName}`}
                </SectionTitle>
                <AppButton
                  emphasis="outline"
                  onClick={() => setEditing({ assetId: selectedAssetId })}
                >
                  Nova operação
                </AppButton>
              </AppStack>
              <AssetTrades
                trades={selectedTrades}
                onEdit={(trade) => setEditing({ trade, assetId: trade.asset_id })}
              />
            </AppStack>
          )}
        </>
      )}

      <TradeForm
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSave={() => {
          void refreshPortfolio()
          setVersion((current) => current + 1)
        }}
        trade={editing?.trade}
        assetId={editing?.assetId}
      />

      <AppSnackbar
        open={notice !== null}
        message={notice?.message ?? ''}
        tone={notice?.tone ?? 'info'}
        onClose={() => setNotice(null)}
      />
    </AppStack>
  )
}
