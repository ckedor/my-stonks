import { useQuery } from '@tanstack/react-query'
import { useAppTheme } from '@/components/ui'
import { REBALANCING_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { RebalancingResponse } from '@/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { planContribution } from './contribution'

/* O rebalanceamento de uma carteira, ou de uma parte dela.
 *
 * O alvo é sempre da categoria: a categoria tem um peso na carteira e cada
 * ativo tem um peso dentro dela. Por isso um recorte — um segmento, uma
 * categoria — não recorta os números, recorta *quais categorias aparecem*:
 * dentro de cada uma continuam todos os ativos dela, com as porcentagens que
 * de fato valem. Esconder metade dos ativos de uma categoria faria a soma
 * dentro dela deixar de fechar, e o aporte simulado sobraria para quem ficou.
 *
 * O rascunho editado é sempre a carteira inteira, mesmo quando a tela mostra
 * um pedaço: salvar envia tudo, e um alvo fora do recorte não se perde. */

const round2 = (v: number) => Math.round(v * 100) / 100

/** Refaz a conta do backend sobre os alvos editados na tela.
 *
 *  Só existe porque os alvos são editáveis: mudar um `% Alvo` tem de mover a
 *  diferença na mesma hora, antes de salvar. A base é sempre o patrimônio de
 *  hoje — o aporte simulado não entra aqui, e é justamente por ele entrar que
 *  a tela confundia antes: digitar um valor reescrevia o diagnóstico inteiro
 *  contra uma carteira que ainda não existe. */
function withDiffs(data: RebalancingResponse): RebalancingResponse {
  const total = data.total_value

  return {
    ...data,
    categories: data.categories.map((cat) => {
      const targetValue = cat.target_pct != null ? (total * cat.target_pct) / 100 : null

      return {
        ...cat,
        target_value: targetValue != null ? round2(targetValue) : null,
        diff_pct: cat.target_pct != null ? round2(cat.target_pct - cat.current_pct) : null,
        diff_value: targetValue != null ? round2(targetValue - cat.current_value) : null,
        assets: cat.assets.map((asset) => {
          if (asset.target_pct_in_category == null || targetValue == null) {
            return { ...asset, target_value: null, diff_value: null, diff_pct: null }
          }
          const assetTarget = (targetValue * asset.target_pct_in_category) / 100
          return {
            ...asset,
            target_value: round2(assetTarget),
            diff_value: round2(assetTarget - asset.current_value),
            diff_pct: round2(asset.target_pct_in_category - asset.current_pct_in_category),
          }
        }),
      }
    }),
  }
}

export interface UseRebalancingOptions {
  /** As categorias que a tela mostra. Sem a lista, mostra todas. */
  categoryNames?: string[]
}

export function useRebalancing(portfolioId: number | undefined, options: UseRebalancingOptions = {}) {
  const { categoryNames } = options

  const { data: fetchedData } = useQuery<RebalancingResponse>({
    queryKey: [portfolioId ? `rebalancing:${portfolioId}` : null],
    queryFn: useCallback(
      () =>
        api
          .get<RebalancingResponse>(REBALANCING_ROUTES.byPortfolio(portfolioId!))
          .then((r) => r.data),
      [portfolioId],
    ),
    enabled: (portfolioId ? `rebalancing:${portfolioId}` : null) != null && !!portfolioId,
  })

  /* `data` guarda só os alvos: é o rascunho que o botão de salvar envia. Tudo
     que é derivado — diferença, valor alvo, plano de compra — se recalcula a
     partir dele, em vez de ser escrito de volta nele. */
  const [data, setData] = useState<RebalancingResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })
  const [simulating, setSimulating] = useState(false)
  const [contribution, setContribution] = useState<number | null>(null)
  const [openCategories, setOpenCategories] = useState<number[]>([])

  useEffect(() => {
    if (fetchedData) setData(fetchedData)
  }, [fetchedData])

  const theme = useAppTheme()

  /* Uma categoria sozinha já vem aberta. Quando o recorte é ela, a linha-pai
     não é uma escolha de navegação — é o cabeçalho do que a página veio
     mostrar, e deixar os ativos escondidos atrás de um clique é esconder o
     conteúdo da tela dentro dela mesma. Com mais de uma, o fechado continua
     sendo o certo: aí a pergunta é a repartição entre elas. */
  const onlyCategoryId =
    fetchedData?.categories.length === 1 ? fetchedData.categories[0].category_id : null
  useEffect(() => {
    if (onlyCategoryId != null) setOpenCategories([onlyCategoryId])
  }, [onlyCategoryId])

  const loading = !fetchedData && !!portfolioId

  /* O recorte escolhe quais categorias aparecem, e nada mais.

     As porcentagens continuam sendo as da carteira: `% Alvo` é a fatia que a
     categoria deve ter no patrimônio inteiro, é isso que o campo edita e é
     isso que vai ser salvo. Rebasear `% Atual` para o recorte faria a coluna
     ao lado comparar duas bases diferentes — e reescrever `% Alvo` junto
     faria o campo mostrar um número que não é o que ele grava. Então elas não
     somam 100 numa aba de recorte, e é assim que devem ficar: o total abaixo
     diz quanto o recorte pesa, em vez de fingir que ele é a carteira. */
  const view = useMemo(() => {
    if (!data) return null

    const withTargets = withDiffs(data)
    if (!categoryNames) return withTargets

    const wanted = new Set(categoryNames)
    const categories = withTargets.categories.filter((cat) => wanted.has(cat.category_name))

    return {
      ...withTargets,
      categories,
      total_value: categories.reduce((sum, cat) => sum + cat.current_value, 0),
    }
  }, [data, categoryNames])

  /* Quanto comprar de cada categoria, e de cada ativo dentro dela. Fora da
     simulação é tudo zero: sem aporte não há compra a sugerir. */
  const buyPlan = useMemo(() => {
    const empty = { byCategory: new Map<number, number>(), byAsset: new Map<number, number>() }
    if (!view || !simulating || !contribution) return empty

    const categoryPlan = planContribution(
      view.categories.map((cat) => ({ value: cat.current_value, targetPct: cat.target_pct })),
      contribution,
    )

    view.categories.forEach((cat, index) => {
      const amount = categoryPlan[index]
      empty.byCategory.set(cat.category_id, amount)

      /* Dentro da categoria vale a mesma regra: o que ela recebeu é o aporte,
         e os pesos são os alvos dos ativos dela. */
      const assetPlan = planContribution(
        cat.assets.map((asset) => ({
          value: asset.current_value,
          targetPct: asset.target_pct_in_category,
        })),
        amount,
      )
      cat.assets.forEach((asset, assetIndex) => {
        empty.byAsset.set(asset.asset_id, assetPlan[assetIndex])
      })
    })

    return empty
  }, [view, simulating, contribution])

  const effectiveTotal = (view?.total_value ?? 0) + (simulating ? (contribution ?? 0) : 0)

  /* As duas pizzas: como a carteira está, e como ela fica. Fora da simulação
     a segunda é a alocação alvo; dentro dela, a carteira depois do aporte —
     que é o que torna visível o efeito de ligar o interruptor. */
  const pies = useMemo(() => {
    if (!view) return { current: [], suggested: [] }

    /* Dentro de uma categoria só, a pizza é dos ativos dela.
       Fatiada por categoria ali, ela desenha uma rosca de 100% com o nome do
       recorte no meio — que é onde o leitor já sabe que está. A pergunta de
       quem abre a página de uma categoria é como *ela* se reparte, e quem
       responde isso são IVV, QQQM e SCHD. A cor sai da paleta de gráfico
       porque um ativo não tem cor própria no cadastro; a categoria tem, e é
       por isso que a fatia por categoria continua usando a dela. */
    const single = view.categories.length === 1 ? view.categories[0] : null

    if (single) {
      const palette = theme.palette.chart.colors
      const color = (index: number) => palette[index % palette.length]

      return {
        current: single.assets.map((asset, index) => ({
          label: asset.ticker,
          value: asset.current_value,
          color: color(index),
        })),
        suggested: single.assets.map((asset, index) => ({
          label: asset.ticker,
          color: color(index),
          value: simulating
            ? asset.current_value + (buyPlan.byAsset.get(asset.asset_id) ?? 0)
            : (asset.target_value ?? asset.current_value),
        })),
      }
    }

    const current = view.categories.map((cat) => ({
      label: cat.category_name,
      value: cat.current_value,
      color: cat.color,
    }))

    const suggested = view.categories.map((cat) => ({
      label: cat.category_name,
      color: cat.color,
      value: simulating
        ? cat.current_value + (buyPlan.byCategory.get(cat.category_id) ?? 0)
        : cat.target_pct != null
          ? (view.total_value * cat.target_pct) / 100
          : cat.current_value,
    }))

    return { current, suggested }
  }, [view, simulating, buyPlan, theme])

  const setCategoryTarget = useCallback((categoryId: number, value: number | null) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            categories: prev.categories.map((cat) =>
              cat.category_id === categoryId ? { ...cat, target_pct: value } : cat,
            ),
          }
        : prev,
    )
  }, [])

  const setAssetTarget = useCallback(
    (categoryId: number, assetId: number, value: number | null) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              categories: prev.categories.map((cat) =>
                cat.category_id !== categoryId
                  ? cat
                  : {
                      ...cat,
                      assets: cat.assets.map((asset) =>
                        asset.asset_id === assetId
                          ? { ...asset, target_pct_in_category: value }
                          : asset,
                      ),
                    },
              ),
            }
          : prev,
      )
    },
    [],
  )

  const toggleCategory = useCallback((categoryId: number) => {
    setOpenCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    )
  }, [])

  const save = useCallback(async () => {
    if (!data || !portfolioId) return
    setSaving(true)
    try {
      /* O rascunho inteiro, e não o recorte: salvar de dentro de uma aba não
         pode apagar o alvo de uma categoria que a aba não mostra. */
      const payload = {
        portfolio_id: portfolioId,
        categories: data.categories
          .filter((c) => c.category_id !== 0)
          .map((c) => ({
            category_id: c.category_id,
            target_percentage: c.target_pct ?? 0,
            assets: c.assets.map((a) => ({
              asset_id: a.asset_id,
              target_percentage: a.target_pct_in_category ?? 0,
            })),
          })),
      }
      await api.put(REBALANCING_ROUTES.byPortfolio(portfolioId), payload)
      setSnackbar({ open: true, message: 'Targets salvos com sucesso!', severity: 'success' })
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Erro ao salvar targets.'
      setSnackbar({ open: true, message: detail, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }, [data, portfolioId])

  const categoryTargetSum = view
    ? view.categories.reduce((s, c) => s + (c.target_pct ?? 0), 0)
    : 0

  return {
    loading,
    view,
    buyPlan,
    pies,
    openCategories,
    toggleCategory,
    setCategoryTarget,
    setAssetTarget,
    simulating,
    setSimulating,
    contribution,
    setContribution,
    effectiveTotal,
    categoryTargetSum,
    save,
    saving,
    snackbar,
    closeSnackbar: useCallback(() => setSnackbar((s) => ({ ...s, open: false })), []),
  }
}
