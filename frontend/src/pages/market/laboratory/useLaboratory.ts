import type {
  Frequency,
  Preset,
  SaveTheoreticalPortfolio,
  TheoreticalPortfolio,
} from '@/api/lab'
import { useCallback, useMemo, useState } from 'react'

/* O rascunho da bancada.
 *
 * É estado de cliente, e fica aqui: uma carteira em edição não é resposta de
 * API, e copiá-la para dentro de um store faria dois lugares discordarem sobre
 * qual é o peso de uma linha. O que vem do servidor é a lista de carteiras
 * salvas, que é query; o que está sendo mexido é isto.
 *
 * A forma segue `useRebalancing`: o estado guarda só o que a pessoa digitou, e
 * tudo que é derivado — a soma dos pesos, as fatias da pizza — sai de um
 * `useMemo` sobre ele. */

/** Uma linha do rascunho. `key` é local e existe só para a lista ter
 *  identidade estável enquanto nenhuma linha tem id do banco. */
export interface DraftLine {
  key: string
  weight: number
  assetId: number | null
  seriesId: number | null
  fixedIncomeTypeId: number | null
  rate: number | null
  label: string
}

export interface LabDraft {
  id: number | null
  name: string
  initialAmount: number
  contributionAmount: number
  contributionFrequency: Frequency
  rebalanceFrequency: Frequency
  benchmarkIds: number[]
  years: number | null
  lines: DraftLine[]
}

/** A janela padrão. Dez anos é o que o mantenedor pediu como o teto dos
 *  presets, e é a que mais depende de haver histórico. */
export const DEFAULT_YEARS = 5

export const EMPTY_DRAFT: LabDraft = {
  id: null,
  name: '',
  initialAmount: 10000,
  contributionAmount: 1000,
  contributionFrequency: 'monthly',
  rebalanceFrequency: 'semiannual',
  benchmarkIds: [],
  years: DEFAULT_YEARS,
  lines: [],
}

let nextKey = 0
const makeKey = () => `line-${(nextKey += 1)}`

export function draftFromPortfolio(portfolio: TheoreticalPortfolio): LabDraft {
  return {
    id: portfolio.id,
    name: portfolio.name,
    initialAmount: portfolio.initial_amount,
    contributionAmount: portfolio.contribution_amount,
    contributionFrequency: portfolio.contribution_frequency,
    rebalanceFrequency: portfolio.rebalance_frequency,
    benchmarkIds: portfolio.benchmark_id === null ? [] : [portfolio.benchmark_id],
    years: DEFAULT_YEARS,
    lines: portfolio.positions.map((position) => ({
      key: makeKey(),
      weight: position.weight,
      assetId: position.asset_id,
      seriesId: position.series_id,
      fixedIncomeTypeId: position.fixed_income_type_id,
      rate: position.rate,
      label: position.label ?? '',
    })),
  }
}

export function draftFromPreset(preset: Preset): LabDraft {
  return {
    ...EMPTY_DRAFT,
    name: preset.name,
    contributionFrequency: preset.contribution_frequency,
    rebalanceFrequency: preset.rebalance_frequency,
    lines: preset.lines.map((line) => ({
      key: makeKey(),
      weight: line.weight,
      assetId: null,
      seriesId: line.series_id,
      fixedIncomeTypeId: line.fixed_income_type_id,
      rate: line.rate,
      label: line.label,
    })),
  }
}

/** As linhas do rascunho no formato que a API recebe. Serve tanto para salvar
 *  quanto para simular — é a mesma alocação. */
export function draftPositions(draft: LabDraft) {
  return draft.lines.map((line) => ({
    weight: line.weight,
    asset_id: line.assetId,
    series_id: line.assetId === null ? line.seriesId : null,
    fixed_income_type_id: line.assetId === null ? line.fixedIncomeTypeId : null,
    rate: line.assetId === null ? line.rate : null,
    label: line.assetId === null ? line.label || null : null,
  }))
}

export function draftToPayload(draft: LabDraft): SaveTheoreticalPortfolio {
  return {
    name: draft.name.trim(),
    initial_amount: draft.initialAmount,
    contribution_amount: draft.contributionAmount,
    contribution_frequency: draft.contributionFrequency,
    rebalance_frequency: draft.rebalanceFrequency,
    benchmark_id: draft.benchmarkIds[0] ?? null,
    positions: draftPositions(draft),
  }
}

export function useLaboratory() {
  const [draft, setDraft] = useState<LabDraft>(EMPTY_DRAFT)

  const patch = useCallback((changes: Partial<LabDraft>) => {
    setDraft((current) => ({ ...current, ...changes }))
  }, [])

  const addLine = useCallback((line: Omit<DraftLine, 'key'>) => {
    setDraft((current) => ({
      ...current,
      lines: [...current.lines, { ...line, key: makeKey() }],
    }))
  }, [])

  const updateLine = useCallback((key: string, changes: Partial<DraftLine>) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.key === key ? { ...line, ...changes } : line,
      ),
    }))
  }, [])

  const removeLine = useCallback((key: string) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.key !== key),
    }))
  }, [])

  /** Distribui 100 igualmente entre as linhas. O atalho que evita a conta de
   *  cabeça toda vez que uma linha entra ou sai. */
  const balanceEvenly = useCallback(() => {
    setDraft((current) => {
      if (current.lines.length === 0) return current
      const share = Math.round((100 / current.lines.length) * 10) / 10
      const lines = current.lines.map((line) => ({ ...line, weight: share }))
      /* A sobra do arredondamento vai para a primeira linha, senão a soma
         mostrada nunca fecha em 100 e a tela acusa um erro que não existe. */
      const drift = 100 - share * lines.length
      lines[0] = { ...lines[0], weight: Math.round((share + drift) * 10) / 10 }
      return { ...current, lines }
    })
  }, [])

  const totalWeight = useMemo(
    () => draft.lines.reduce((sum, line) => sum + line.weight, 0),
    [draft.lines],
  )

  /* Somar 100 é assunto de tela: o motor normaliza de qualquer jeito, mas uma
     carteira que soma 90 não é a que a pessoa quis desenhar. */
  const balanced = Math.abs(totalWeight - 100) < 0.05

  return {
    draft,
    setDraft,
    patch,
    addLine,
    updateLine,
    removeLine,
    balanceEvenly,
    totalWeight,
    balanced,
  }
}
