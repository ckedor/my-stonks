import type {
  FIIMarketFund,
  MarketCatalogue,
  MarketCatalogueAsset,
  MarketCatalogueKind,
  ReferenceEtfReading,
} from '@/api/market'

/** Os setores da B3 como a tela os escreve. O provedor responde numa lista
 *  fixa, em inglês; o que não estiver aqui aparece como veio. */
const SECTOR_LABEL: Record<string, string> = {
  Finance: 'Financeiro',
  Utilities: 'Utilidade pública',
  'Producer Manufacturing': 'Bens industriais',
  'Process Industries': 'Indústria de base',
  'Retail Trade': 'Varejo',
  'Non-Energy Minerals': 'Mineração e siderurgia',
  Transportation: 'Transporte',
  'Consumer Durables': 'Bens duráveis',
  'Commercial Services': 'Serviços comerciais',
  'Consumer Non-Durables': 'Consumo não cíclico',
  'Industrial Services': 'Serviços industriais',
  'Distribution Services': 'Distribuição',
  'Consumer Services': 'Serviços ao consumidor',
  'Health Services': 'Serviços de saúde',
  'Technology Services': 'Tecnologia',
  Communications: 'Comunicações',
  'Energy Minerals': 'Petróleo e gás',
  'Electronic Technology': 'Tecnologia eletrônica',
  'Health Technology': 'Tecnologia em saúde',
  Miscellaneous: 'Outros',
}

const NO_SECTOR = 'Sem setor'
const OTHER_SECTORS = 'Outros setores'

export const sectorLabel = (sector: string | null) =>
  sector == null ? NO_SECTOR : (SECTOR_LABEL[sector] ?? sector)

/** Quanto dinheiro trocou de mão no dia. Na bolsa o volume é de papéis, e
 *  mil negócios de um papel de centavos não pesam o que pesam mil de cem
 *  reais; na cripto o provedor já responde em moeda. */
export function financialVolume(asset: MarketCatalogueAsset, crypto = false): number | null {
  if (asset.volume == null) return null
  if (crypto) return asset.volume
  return asset.price == null ? null : asset.price * asset.volume
}

/** Os `count` maiores por um critério, do maior para o menor. Quem não tem
 *  o número fica de fora, em vez de ir para o fim como se fosse zero. */
export function largestBy<T>(
  items: T[],
  value: (item: T) => number | null | undefined,
  count = 5
): T[] {
  return items
    .map((item) => ({ item, value: value(item) }))
    .filter((row): row is { item: T; value: number } => row.value != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map((row) => row.item)
}

/** Os mais negociados do dia em dinheiro, do maior para o menor. */
export function mostTraded(
  assets: MarketCatalogueAsset[],
  { crypto = false, count = 10 } = {}
): MarketCatalogueAsset[] {
  return assets
    .map((asset) => ({ asset, volume: financialVolume(asset, crypto) }))
    .filter((row): row is { asset: MarketCatalogueAsset; volume: number } => row.volume != null)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, count)
    .map((row) => row.asset)
}

/** Lote fracionário da B3: o mesmo papel com um F no fim, negociado de uma
 *  em uma ação. É a mesma empresa e o mesmo preço — contá-lo de novo
 *  duplicaria cada nome no mapa e nas listas. */
const isFractionalLot = (ticker: string) => /^[A-Z0-9]{4}\d{1,2}F$/.test(ticker)

/** Os catálogos como a tela os lê: sem lote fracionário, e o de fundos só
 *  com FII. O provedor chama de fundo tudo o que a B3 lista como cota — o
 *  fundo de índice, que já está no catálogo de ETFs e fazia o BOVA11 aparecer
 *  duas vezes em cada ranking; o próprio Ibovespa, como IBOV11, que abria a
 *  lista dos mais negociados com trinta bilhões; FIAGRO e FI-Infra. Um FII é
 *  o que a leitura de FIIs conhece, e `fiiTickers` é ela. */
export function cleanCatalogues(
  catalogues: Map<MarketCatalogueKind, MarketCatalogue>,
  fiiTickers: ReadonlySet<string>
): Map<MarketCatalogueKind, MarketCatalogueAsset[]> {
  const clean = new Map<MarketCatalogueKind, MarketCatalogueAsset[]>()
  for (const [kind, catalogue] of catalogues) {
    clean.set(
      kind,
      catalogue.assets.filter(
        (asset) =>
          (kind === 'crypto' || !isFractionalLot(asset.ticker)) &&
          (kind !== 'fii' || fiiTickers.has(asset.ticker))
      )
    )
  }
  return clean
}

/** Uma linha por empresa, a da classe mais negociada. As quatro letras do
 *  ticker são o emissor na B3: PETR3 e PETR4 são a mesma Petrobras, e o
 *  valor de mercado que o provedor dá para cada uma é o da empresa inteira. */
export function onePerCompany(assets: MarketCatalogueAsset[]): MarketCatalogueAsset[] {
  const byCompany = new Map<string, MarketCatalogueAsset>()
  for (const asset of mostTraded(assets, { count: assets.length })) {
    const company = asset.ticker.slice(0, 4)
    if (!byCompany.has(company)) byCompany.set(company, asset)
  }
  return [...byCompany.values()]
}

export interface SectorGroup {
  sector: string
  assets: MarketCatalogueAsset[]
  marketCap: number
}

/** As maiores empresas por valor de mercado, agrupadas por setor, o setor
 *  maior primeiro. `count` limita o mapa: com as 777 ações, os blocos das
 *  pequenas viram riscos que não se leem.
 *
 *  Uma empresa entra uma vez, pela classe mais negociada: o valor de mercado
 *  que o provedor dá para PETR3 e para PETR4 é o da Petrobras inteira, e
 *  somar os dois contaria a empresa em dobro. */
export function sectorGroups(
  assets: MarketCatalogueAsset[],
  count = 120,
  minShare = 0
): SectorGroup[] {
  const largest = onePerCompany(assets)
    .filter((asset) => asset.market_cap != null && asset.market_cap > 0)
    .sort((a, b) => b.market_cap! - a.market_cap!)
    .slice(0, count)
  const groups = new Map<string, SectorGroup>()
  for (const asset of largest) {
    const sector = sectorLabel(asset.sector)
    const group = groups.get(sector) ?? { sector, assets: [], marketCap: 0 }
    group.assets.push(asset)
    group.marketCap += asset.market_cap!
    groups.set(sector, group)
  }
  const sorted = [...groups.values()].sort((a, b) => b.marketCap - a.marketCap)
  /* Um setor pequeno demais vira uma fresta onde o nome dele não cabe e
     encavala no do vizinho: abaixo de `minShare` do total, os setores se
     juntam num só, no fim. */
  const total = sorted.reduce((sum, group) => sum + group.marketCap, 0)
  const large = sorted.filter((group) => group.marketCap >= total * minShare)
  const small = sorted.filter((group) => group.marketCap < total * minShare)
  if (small.length < 2) return sorted
  return [
    ...large,
    {
      sector: OTHER_SECTORS,
      assets: small.flatMap((group) => group.assets),
      marketCap: small.reduce((sum, group) => sum + group.marketCap, 0),
    },
  ]
}

/** Os dados de fundo de cada FII — segmento, P/VP, dividend yield — por
 *  ticker, para somar à linha do catálogo. */
export function fundsByTicker(funds: FIIMarketFund[]): Map<string, FIIMarketFund> {
  return new Map(funds.map((fund) => [fund.ticker.toUpperCase(), fund]))
}

/** Um ETF de referência na forma de linha de mercado, para os cards de
 *  altas e baixas que as outras classes usam. */
export const etfAsMarketRow = (etf: ReferenceEtfReading): MarketCatalogueAsset => ({
  asset_id: etf.asset_id,
  ticker: etf.ticker,
  name: etf.name,
  price: etf.reading.value,
  change_percent: etf.day_change == null ? null : etf.day_change * 100,
  volume: null,
  market_cap: null,
  currency: etf.currency ?? 'USD',
  logo_url: null,
  sector: null,
  subsector: null,
})
