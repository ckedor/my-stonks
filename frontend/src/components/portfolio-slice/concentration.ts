import type { PortfolioPositionEntry } from '@/types'

/* Como um recorte da carteira se divide por dentro.
 *
 * Toda tela de recorte faz a mesma pergunta — onde está concentrado o dinheiro
 * que está aqui — e muda só a dimensão pela qual ela é respondida. A dimensão é
 * a leitura de um campo da posição, e nada mais: o que separa "por segmento de
 * FII" de "por setor da ação" é qual campo se lê, não como se agrupa. */

/** Grupo sem nome. Não some da conta: uma fatia escondida faz o total mentir. */
const UNCLASSIFIED = 'Não classificado'

export interface ConcentrationDimension {
  value: string
  label: string
  hint?: string
  /** O campo da posição que dá o nome do grupo. */
  read: (position: PortfolioPositionEntry) => string | null | undefined
}

export interface ConcentrationEntry {
  label: string
  value: number
  assetCount: number
}

/** As dimensões que existem, uma por campo que uma posição publica.
 *
 *  `asset` é a única que serve a qualquer recorte: todo ativo tem código, e
 *  "quanto pesa cada ativo daqui" é a pergunta que toda tela especializada
 *  responde antes de qualquer outra. */
export const CONCENTRATION_DIMENSIONS = {
  asset: {
    value: 'asset',
    label: 'Ativo',
    hint: 'O peso de cada posição do recorte',
    read: (position) => position.ticker,
  },
  category: {
    value: 'category',
    label: 'Categoria',
    hint: 'As categorias que você criou',
    read: (position) => position.category,
  },
  assetType: {
    value: 'assetType',
    label: 'Tipo',
    hint: 'Ação, ETF, BDR e afins',
    read: (position) => position.type,
  },
  assetClass: {
    value: 'assetClass',
    label: 'Classe',
    hint: 'Renda fixa, renda variável e afins',
    read: (position) => position.class,
  },
  fiiType: {
    value: 'fiiType',
    label: 'Tipo',
    hint: 'Tijolo, papel, híbrido ou FOF',
    read: (position) => position.fii_type,
  },
  fiiSegment: {
    value: 'fiiSegment',
    label: 'Segmento',
    hint: 'Shopping, logística, lajes e outros',
    read: (position) => position.fii_segment,
  },
  etfSegment: {
    value: 'etfSegment',
    label: 'Segmento do ETF',
    hint: 'A exposição que o ETF replica',
    read: (position) => position.etf_segment,
  },
  sector: {
    value: 'sector',
    label: 'Setor',
    hint: 'O setor econômico da empresa',
    read: (position) => position.sector,
  },
  industry: {
    value: 'industry',
    label: 'Indústria',
    hint: 'O recorte fino dentro do setor',
    read: (position) => position.industry,
  },
  country: {
    value: 'country',
    label: 'País',
    hint: 'Onde a empresa é sediada',
    read: (position) => position.country,
  },
  fixedIncomeIndex: {
    value: 'fixedIncomeIndex',
    label: 'Indexador',
    hint: 'CDI, IPCA ou prefixado',
    read: (position) => position.index ?? 'Prefixado',
  },
} satisfies Record<string, ConcentrationDimension>

/** Quanto vale cada grupo do recorte, do maior para o menor.
 *
 *  A ordem é por valor porque a pizza é lida do topo no sentido do relógio: a
 *  fatia que decide o recorte é a primeira. */
export function groupConcentration(
  positions: PortfolioPositionEntry[],
  dimension: ConcentrationDimension,
): ConcentrationEntry[] {
  const grouped = new Map<string, ConcentrationEntry>()

  for (const position of positions) {
    const label = dimension.read(position)?.trim() || UNCLASSIFIED
    const current = grouped.get(label) ?? { label, value: 0, assetCount: 0 }
    current.value += position.value
    current.assetCount += 1
    grouped.set(label, current)
  }

  return [...grouped.values()].sort((a, b) => b.value - a.value)
}

/** As posições de um grupo da dimensão. É o que a pizza filtra ao ser clicada. */
export function positionsInGroup(
  positions: PortfolioPositionEntry[],
  dimension: ConcentrationDimension,
  group: string,
): PortfolioPositionEntry[] {
  return positions.filter(
    (position) => (dimension.read(position)?.trim() || UNCLASSIFIED) === group,
  )
}
