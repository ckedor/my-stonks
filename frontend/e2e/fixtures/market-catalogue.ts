import { level } from './world-readings'

/* Um mercado pequeno e fixo para a tela de ativos: poucas linhas por classe,
   com volume, variação e setor escolhidos para que altas, baixas, os mais
   negociados e o mapa tenham o que mostrar e nunca empatem. */

const row = (
  ticker: string,
  name: string,
  price: number,
  change: number,
  volume: number,
  extra: { asset_id?: number; market_cap?: number; sector?: string; subsector?: string } = {},
) => ({
  asset_id: extra.asset_id ?? null,
  ticker,
  name,
  price,
  change_percent: change,
  volume,
  market_cap: extra.market_cap ?? null,
  currency: 'BRL',
  logo_url: null,
  sector: extra.sector ?? null,
  subsector: extra.subsector ?? null,
})

const catalogue = (assets: ReturnType<typeof row>[]) => ({
  assets,
  total: assets.length,
  source: 'brapi',
})

export const MARKET_CATALOGUES: Record<string, ReturnType<typeof catalogue>> = {
  stock: catalogue([
    row('PETR4', 'Petrobras PN', 38.5, -1.2, 40_000_000, {
      asset_id: 1,
      market_cap: 500e9,
      sector: 'Energy Minerals',
      subsector: 'Petróleo, Gás e Biocombustíveis',
    }),
    row('VALE3', 'Vale ON', 61.2, 2.4, 20_000_000, {
      market_cap: 280e9,
      sector: 'Non-Energy Minerals',
      subsector: 'Mineração',
    }),
    row('ITUB4', 'Itaú Unibanco PN', 35.1, 0.8, 18_000_000, {
      market_cap: 330e9,
      sector: 'Finance',
      subsector: 'Bancos',
    }),
    row('BBAS3', 'Banco do Brasil ON', 27.4, -0.4, 16_000_000, {
      market_cap: 150e9,
      sector: 'Finance',
      subsector: 'Bancos',
    }),
    row('WEGE3', 'WEG ON', 52.3, 1.1, 5_000_000, {
      market_cap: 220e9,
      sector: 'Producer Manufacturing',
      subsector: 'Máquinas e Equipamentos',
    }),
    row('MGLU3', 'Magazine Luiza ON', 9.8, -3.5, 30_000_000, {
      market_cap: 7e9,
      sector: 'Retail Trade',
      subsector: 'Eletrodomésticos',
    }),
  ]),
  fii: catalogue([
    row('HGLG11', 'CSHG Logística FII', 158.3, 0.6, 120_000, { asset_id: 2 }),
    row('KNRI11', 'Kinea Renda Imobiliária FII', 140.2, -0.3, 90_000),
    row('XPML11', 'XP Malls FII', 101.4, 1.4, 150_000),
  ]),
  etf: catalogue([
    row('BOVA11', 'iShares Ibovespa', 125.6, 0.5, 6_000_000, { asset_id: 3 }),
    row('IVVB11', 'iShares S&P 500', 330.1, -0.7, 800_000),
  ]),
  bdr: catalogue([row('AAPL34', 'Apple DRN', 62.5, 0.9, 400_000, { sector: 'Electronic Technology' })]),
  crypto: catalogue([
    row('BTC', 'Bitcoin', 480_000, 1.8, 2_000_000_000),
    row('ETH', 'Ethereum', 17_500, -2.2, 900_000_000),
  ]),
}

export const FII_MARKET = {
  funds: [
    ['HGLG11', 'Logística', 1.02, 0.085, 608_000],
    ['KNRI11', 'Híbrido', 0.94, 0.079, 290_000],
    ['XPML11', 'Shoppings', 0.91, 0.096, 733_000],
  ].map(([ticker, segment, priceToNav, dividendYield, investors]) => ({
    asset_id: null,
    ticker,
    name: ticker,
    cnpj: null,
    type: 'tijolo',
    segment,
    mandate: null,
    management_type: null,
    administrator: null,
    price: null,
    nav_per_share: null,
    price_to_nav: priceToNav,
    dividend_yield_12m: dividendYield,
    investors,
  })),
  total: 3,
  source: 'brapi',
}

/* `GET /market_data/readings/etfs`: poucos ETFs de exposições diferentes, com
   a mesma leitura sintética da aba Mundo e só o último ano de histórico, como
   a rota devolve. */
const etf = (
  ticker: string,
  name: string,
  exposure: string,
  listing: 'us' | 'ucits',
  assetId: number,
  base: number,
  growth: number,
) => {
  const reading = level(ticker, null, base, growth, 0.04)
  return {
    ticker,
    name,
    asset_id: assetId,
    exposure,
    listing,
    currency: 'USD',
    day_change: growth / 50,
    reading: { ...reading, asset_id: assetId, history: reading.history.slice(-53) },
  }
}

export const ETF_READINGS = [
  etf('VOO', 'Vanguard S&P 500 ETF', 'usa', 'us', 101, 90, 0.14),
  etf('CSPX.L', 'iShares Core S&P 500 UCITS ETF', 'usa', 'ucits', 102, 110, 0.13),
  etf('VT', 'Vanguard Total World Stock ETF', 'world', 'us', 103, 60, 0.11),
  etf('VWO', 'Vanguard FTSE Emerging Markets ETF', 'emerging', 'us', 104, 40, 0.06),
  etf('SCHD', 'Schwab US Dividend Equity ETF', 'dividends', 'us', 105, 20, 0.09),
  etf('GLD', 'SPDR Gold Shares', 'gold', 'us', 106, 80, 0.08),
]
