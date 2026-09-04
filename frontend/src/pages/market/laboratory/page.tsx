import type { BacktestResult, RunBacktest, TheoreticalPortfolio } from '@/api/lab'
import {
  AppButton,
  AppCard,
  AppGrid,
  AppGridItem,
  AppIconButton,
  AppListRow,
  AppPageHeader,
  AppPieChart,
  AppSelect,
  AppSideDrawer,
  AppSnackbar,
  AppStack,
  AppTabs,
  AppText,
  AppTextField,
  SectionTitle,
} from '@/components/ui'
import { EMPTY_LIST } from '@/queries/empty'
import { usePositions } from '@/queries/portfolio'
import {
  useCompareBacktests,
  useDeleteTheoreticalPortfolio,
  useLabAssets,
  useLabRecommendedPortfolios,
  useLabSeries,
  usePresets,
  useRunBacktest,
  useSaveTheoreticalPortfolio,
  useTheoreticalPortfolios,
} from '@/queries/lab'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import AllocationTable from './AllocationTable'
import BacktestResult_, { type ResultTab } from './BacktestResult'
import CompositionPanel from './CompositionPanel'
import LaboratorySkeleton from './LaboratorySkeleton'
import SimulationForm from './SimulationForm'
import VariationsPanel from './VariationsPanel'
import {
  draftFromPortfolio,
  draftFromPreset,
  draftPositions,
  draftToPayload,
  EMPTY_DRAFT,
  useLaboratory,
  type DraftLine,
} from './useLaboratory'

/* A bancada: montar uma carteira que ninguém comprou e ver o que ela teria
 * feito.
 *
 * O rascunho é estado local e a simulação é mutation, não query: ela é cara,
 * sai de um botão, e não é dado de servidor que envelhece. O que é query é a
 * lista de carteiras salvas — e o que se salva é só parâmetro, nunca a curva. */

export default function MarketLaboratoryPage() {
  const {
    draft,
    setDraft,
    patch,
    addLine,
    updateLine,
    removeLine,
    balanceEvenly,
    totalWeight,
    balanced,
  } = useLaboratory()

  const { portfolios, loading: portfoliosLoading } = useTheoreticalPortfolios()
  const presets = usePresets()
  const assetList = useLabAssets()
  const seriesList = useLabSeries()
  const recommended = useLabRecommendedPortfolios()
  const { data: positions } = usePositions()

  const save = useSaveTheoreticalPortfolio()
  const remove = useDeleteTheoreticalPortfolio()
  const backtest = useRunBacktest()
  const variations = useCompareBacktests()

  const [result, setResult] = useState<BacktestResult | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [tab, setTab] = useState<'carteira' | ResultTab | 'variations'>('carteira')
  const { id: routeId } = useParams()
  const [notice, setNotice] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null)

  const assetById = useMemo(
    () => new Map(assetList.map((item) => [item.id, item])),
    [assetList],
  )
  const seriesById = useMemo(
    () => new Map(seriesList.map((item) => [item.id, item])),
    [seriesList],
  )

  const labelOf = useCallback(
    (line: DraftLine) => {
      if (line.assetId !== null) {
        const asset = assetById.get(line.assetId)
        return asset?.ticker || asset?.name || line.label || `Ativo ${line.assetId}`
      }
      return line.label || seriesById.get(line.seriesId ?? -1)?.short_name || 'Linha'
    },
    [assetById, seriesById],
  )

  const captionOf = useCallback(
    (line: DraftLine) => {
      if (line.assetId !== null) return assetById.get(line.assetId)?.name ?? null
      if (line.fixedIncomeTypeId !== null) return 'Renda fixa sintética'
      return 'Índice'
    },
    [assetById],
  )

  const usedAssetIds = useMemo(
    () =>
      new Set(
        draft.lines
          .map((line) => line.assetId)
          .filter((id): id is number => id !== null),
      ),
    [draft.lines],
  )

  const pieData = useMemo(
    () =>
      draft.lines
        .filter((line) => line.weight > 0)
        .map((line) => ({ label: labelOf(line), value: line.weight })),
    [draft.lines, labelOf],
  )

  const baseRun = useMemo<RunBacktest | null>(() => {
    if (draft.lines.length === 0) return null
    return {
      positions: draftPositions(draft),
      initial_amount: draft.initialAmount,
      contribution_amount: draft.contributionAmount,
      contribution_frequency: draft.contributionFrequency,
      rebalance_frequency: draft.rebalanceFrequency,
      years: draft.years,
      benchmark_ids: draft.benchmarkIds,
      label: draft.name || 'Carteira teórica',
    }
  }, [draft])

  /* A coluna lateral lista as carteiras salvas, e cada uma é um destino. Abrir
     a rota é o que carrega o rascunho — sem seletor no cabeçalho. */
  useEffect(() => {
    if (!routeId) return
    const found = portfolios.find(
      (item: TheoreticalPortfolio) => String(item.id) === routeId,
    )
    if (found && found.id !== draft.id) {
      setDraft(draftFromPortfolio(found))
      setResult(null)
      setTab('carteira')
    }
  }, [routeId, portfolios, draft.id, setDraft])

  const notify = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setNotice({ message, severity })

  const errorMessage = (error: unknown) => {
    const detail = (error as { response?: { data?: { message?: string } } })?.response
    return detail?.data?.message ?? 'Não foi possível completar a ação.'
  }

  const handleRun = () => {
    if (!baseRun) return
    backtest.mutate(baseRun, {
      onSuccess: (answer) => {
        setResult(answer)
        setTab('performance')
      },
      onError: (error) => notify(errorMessage(error), 'error'),
    })
  }

  const handleSave = () => {
    if (!draft.name.trim()) {
      notify('Dê um nome à carteira antes de salvar.', 'info')
      return
    }
    save.mutate(
      { id: draft.id, data: draftToPayload(draft) },
      {
        onSuccess: (saved) => {
          setDraft(draftFromPortfolio(saved))
          notify('Carteira teórica salva.')
        },
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    )
  }

  const handleLoad = (portfolio: TheoreticalPortfolio) => {
    setDraft(draftFromPortfolio(portfolio))
    setResult(null)
    setTab('carteira')
  }

  const handleNew = () => {
    setDraft(EMPTY_DRAFT)
    setResult(null)
    setTab('carteira')
  }

  const handlePreset = (key: string) => {
    const preset = presets.find((item) => item.key === key)
    if (!preset) return
    setDraft(draftFromPreset(preset))
    setResult(null)
  }

  /* Uma carteira recomendada vira rascunho copiando peso e ativo. A linha sem
     ativo cadastrado é descartada e o descarte é dito: o laboratório não sabe
     precificar um ticker que o catálogo não carrega, e sumir com ela em
     silêncio mudaria o peso das que ficaram. */
  const handleRecommended = (id: string) => {
    const edition = recommended.find((item) => String(item.id) === id)
    if (!edition) return
    const linked = edition.positions.filter((position) => position.asset_id !== null)
    const dropped = edition.positions.length - linked.length
    setDraft({
      ...EMPTY_DRAFT,
      name: edition.title,
      lines: linked.map((position, index) => ({
        key: `rec-${edition.id}-${index}`,
        weight: position.weight,
        assetId: position.asset_id,
        seriesId: null,
        fixedIncomeTypeId: null,
        rate: null,
        label: position.ticker,
      })),
    })
    setResult(null)
    if (dropped > 0) {
      notify(
        `${dropped} linha(s) ficaram de fora: o catálogo não tem esses ativos.`,
        'info',
      )
    }
  }

  /* A carteira real vira rascunho pela participação de cada posição. Posição
     sem cotação — renda fixa, previdência — não entra, e o aviso diz quantas. */
  const handleMyPortfolio = () => {
    const priced = (positions ?? EMPTY_LIST).filter((position) => position.value > 0)
    const total = priced.reduce((sum, position) => sum + position.value, 0)
    if (total <= 0) {
      notify('A carteira selecionada não tem posição com valor.', 'info')
      return
    }
    setDraft({
      ...EMPTY_DRAFT,
      name: 'Cópia da minha carteira',
      lines: priced.map((position, index) => ({
        key: `mine-${index}`,
        weight: Math.round((position.value / total) * 1000) / 10,
        assetId: position.asset_id,
        seriesId: null,
        fixedIncomeTypeId: null,
        rate: null,
        label: position.ticker,
      })),
    })
    setResult(null)
  }

  if (portfoliosLoading) return <LaboratorySkeleton />

  const resultTabs =
    result === null
      ? []
      : [
          { id: 'performance' as const, label: 'Rentabilidade' },
          { id: 'risk' as const, label: 'Risco' },
          { id: 'composition' as const, label: 'Composição no fim' },
          { id: 'variations' as const, label: 'Variações' },
        ]

  return (
    <AppStack gap="lg">
      {/* O cabeçalho diz o nome da tela e o que se pode fazer nela. Contagem de
          linhas, janela e soma dos pesos saíram: são estado da carteira, e cada
          um já aparece onde é editado. */}
      <AppPageHeader
        title="Laboratório"
        breadcrumbs={[{ label: 'Mercado', href: '/market/overview' }, { label: 'Laboratório' }]}
        description="Monte uma carteira que ninguém comprou e veja o que ela teria feito."
        actions={
          <>
            <AppButton emphasis="outline" onClick={handleNew}>
              Nova
            </AppButton>
            {draft.id !== null && (
              <AppIconButton
                label={`Excluir ${draft.name}`}
                onClick={() =>
                  remove.mutate(draft.id!, {
                    onSuccess: () => {
                      setDraft(EMPTY_DRAFT)
                      setResult(null)
                      notify('Carteira teórica removida.')
                    },
                  })
                }
              >
                <DeleteOutlineIcon fontSize="small" />
              </AppIconButton>
            )}
            <AppSelect
              label="Modelo"
              value=""
              onChange={handlePreset}
              options={[
                { value: '', label: 'Escolher…' },
                ...presets.map((item) => ({ value: item.key, label: item.name })),
              ]}
            />
            <AppSelect
              label="Recomendada"
              value=""
              onChange={handleRecommended}
              options={[
                { value: '', label: 'Escolher…' },
                ...recommended.map((item) => ({
                  value: String(item.id),
                  label: item.title,
                })),
              ]}
            />
            <AppButton emphasis="outline" onClick={handleMyPortfolio}>
              Minha carteira
            </AppButton>
            <AppButton onClick={handleSave} loading={save.isPending}>
              Salvar
            </AppButton>
          </>
        }
      />

      {resultTabs.length > 0 && (
        <AppTabs
          label="Partes do laboratório"
          value={tab}
          onChange={setTab}
          items={[{ id: 'carteira' as const, label: 'Carteira' }, ...resultTabs]}
        />
      )}

      {tab === 'carteira' && (
        <AppGrid cols={{ xs: 1, lg: 12 }} gap="lg">
          <AppGridItem span={{ xs: 1, lg: 7 }}>
            <AppStack gap="md">
              <SectionTitle>Alocação</SectionTitle>
              {/* Um card só: a pizza, os controles e a lista são a mesma
                  coisa vista de dois jeitos, e uma moldura dentro da outra só
                  acrescenta borda. */}
              <AppCard>
                <AppStack gap="md">
                  <AppTextField
                    label="Nome da carteira"
                    value={draft.name}
                    onChange={(value) => patch({ name: value })}
                  />
                  {pieData.length > 0 ? (
                    <AppPieChart data={pieData} height={260} minOuterLabelPercentage={4} />
                  ) : (
                    <AppText tone="secondary">
                      Adicione linhas e distribua os pesos para ver a pizza.
                    </AppText>
                  )}
                  <AppStack direction="row" gap="sm" justify="end">
                    <AppButton emphasis="outline" onClick={balanceEvenly}>
                      Distribuir igualmente
                    </AppButton>
                    <AppButton onClick={() => setToolsOpen(true)}>
                      <AddIcon fontSize="small" />
                      Adicionar ativo
                    </AppButton>
                  </AppStack>
                  <AllocationTable
                    lines={draft.lines}
                    totalWeight={totalWeight}
                    balanced={balanced}
                    labelOf={labelOf}
                    captionOf={captionOf}
                    onWeightChange={(key, weight) => updateLine(key, { weight })}
                    onRemove={removeLine}
                  />
                </AppStack>
              </AppCard>
            </AppStack>
          </AppGridItem>

          <AppGridItem span={{ xs: 1, lg: 5 }}>
            <AppStack gap="md">
              {/* A lista fica à vista: escolher qual carteira abrir é a
                  primeira coisa que se faz aqui, e atrás de um botão ela
                  desaparecia. */}
              {portfolios.length > 0 && (
                <>
                  <SectionTitle>Minhas carteiras</SectionTitle>
                  <AppCard>
                    <AppStack gap="none">
                      {portfolios.map((item: TheoreticalPortfolio) => (
                        <AppListRow
                          key={item.id}
                          onClick={() => handleLoad(item)}
                          selected={item.id === draft.id}
                        >
                          <AppStack grow gap="none">
                            <AppText>{item.name}</AppText>
                          </AppStack>
                          <AppIconButton
                            label={`Excluir ${item.name}`}
                            onClick={() =>
                              remove.mutate(item.id, {
                                onSuccess: () => {
                                  if (draft.id === item.id) setDraft(EMPTY_DRAFT)
                                  notify('Carteira teórica removida.')
                                },
                              })
                            }
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </AppIconButton>
                        </AppListRow>
                      ))}
                    </AppStack>
                  </AppCard>
                </>
              )}

              <SectionTitle>Simulação</SectionTitle>
              <AppCard>
                <AppStack gap="md">
                  <SimulationForm draft={draft} series={seriesList} onChange={patch} />
                  <AppStack direction="row" gap="sm" justify="end">
                    <AppButton
                      onClick={handleRun}
                      loading={backtest.isPending}
                      disabled={draft.lines.length === 0}
                    >
                      Rodar simulação
                    </AppButton>
                  </AppStack>
                </AppStack>
              </AppCard>
            </AppStack>
          </AppGridItem>
        </AppGrid>
      )}

      {result && tab !== 'carteira' && tab !== 'variations' && (
        <BacktestResult_ result={result} tab={tab} />
      )}

      {result && tab === 'variations' && (
        <AppCard>
          <VariationsPanel
            baseRun={baseRun}
            results={variations.data ?? EMPTY_LIST}
            running={variations.isPending}
            onRun={(runs) => variations.mutate(runs)}
          />
        </AppCard>
      )}

      {/* O ferramental abre por cima em vez de morar numa coluna: ele é usado
          por alguns segundos e a carteira fica na tela o tempo todo. */}
      <AppSideDrawer
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        title="Adicionar ativo"
        width="sm"
      >
        <CompositionPanel
          assets={assetList}
          series={seriesList}
          usedAssetIds={usedAssetIds}
          onAdd={(line) => {
            addLine(line)
            setToolsOpen(false)
          }}
        />
      </AppSideDrawer>


      <AppSnackbar
        open={notice !== null}
        message={notice?.message ?? ''}
        severity={notice?.severity ?? 'success'}
        onClose={() => setNotice(null)}
      />
    </AppStack>
  )
}
