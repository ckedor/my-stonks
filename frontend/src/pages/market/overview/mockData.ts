export type Trend = 'Alta' | 'Queda' | 'Lateral'
export type Valuation = 'Descontado' | 'Neutro' | 'Esticado'

export interface MarketSeries {
  key: string
  name: string
  value: string
  change12m: number
  color: string
  data: { month: string; value: number }[]
}

export interface MarketRow {
  name: string
  value: string
  month: number
  year: number
  trend: Trend
}

export interface AssetPulse {
  region: 'BR' | 'US' | 'WORLD'
  name: string
  valuation: Valuation
  change: string
  summary: string
  accent: string
}

export const marketSeries: MarketSeries[] = [
  {
    key: 'usd', name: 'Dólar / Real', value: 'R$ 5,68', change12m: 7.8, color: '#3C6E8F',
    data: [100, 101, 99, 103, 106, 104, 108, 111, 109, 112, 110, 107.8].map((value, i) => ({ month: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'][i], value })),
  },
  {
    key: 'sp500', name: 'S&P 500', value: '5.912 pts', change12m: 12.6, color: '#6E8FAD',
    data: [100, 102, 101, 104, 106, 108, 107, 110, 109, 113, 114, 112.6].map((value, i) => ({ month: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'][i], value })),
  },
  {
    key: 'nasdaq', name: 'Nasdaq', value: '19.114 pts', change12m: 17.9, color: '#8570A6',
    data: [100, 103, 101, 106, 109, 112, 110, 115, 113, 119, 121, 117.9].map((value, i) => ({ month: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'][i], value })),
  },
  {
    key: 'cdi', name: 'CDI', value: '14,65% a.a.', change12m: 11.2, color: '#7A9B76',
    data: [100, 100.8, 101.7, 102.6, 103.5, 104.4, 105.3, 106.3, 107.3, 108.4, 109.7, 111.2].map((value, i) => ({ month: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'][i], value })),
  },
  {
    key: 'ipca', name: 'IPCA', value: '5,18% a.a.', change12m: 4.7, color: '#C8923B',
    data: [100, 100.3, 100.7, 101.1, 101.6, 101.9, 102.3, 102.8, 103.2, 103.8, 104.3, 104.7].map((value, i) => ({ month: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'][i], value })),
  },
  {
    key: 'ibov', name: 'Ibovespa', value: '137.420 pts', change12m: 8.4, color: '#A67C52',
    data: [100, 98, 102, 101, 105, 107, 103, 106, 104, 109, 111, 108.4].map((value, i) => ({ month: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'][i], value })),
  },
  {
    key: 'btc', name: 'Bitcoin', value: 'US$ 104.280', change12m: 62.5, color: '#D99032',
    data: [100, 108, 104, 118, 126, 140, 132, 151, 143, 158, 170, 162.5].map((value, i) => ({ month: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'][i], value })),
  },
  {
    key: 'msci', name: 'MSCI World', value: '3.842 pts', change12m: 11.8, color: '#4F8A78',
    data: [100, 101, 100, 103, 105, 107, 106, 109, 108, 111, 113, 111.8].map((value, i) => ({ month: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'][i], value })),
  },
]

export const brazilRows: MarketRow[] = [
  { name: 'Ibovespa', value: '137.420 pts', month: 1.8, year: 8.4, trend: 'Alta' },
  { name: 'IFIX', value: '3.425 pts', month: 0.7, year: 6.1, trend: 'Alta' },
  { name: 'CDI', value: '14,65% a.a.', month: 1.1, year: 11.2, trend: 'Alta' },
  { name: 'Selic', value: '14,75% a.a.', month: 0, year: 3.9, trend: 'Lateral' },
  { name: 'IPCA', value: '5,18% a.a.', month: 0.35, year: 4.7, trend: 'Lateral' },
  { name: 'Dólar / Real', value: 'R$ 5,68', month: 2.4, year: 7.8, trend: 'Alta' },
  { name: 'Juros futuros', value: '13,92%', month: -0.3, year: 0.8, trend: 'Queda' },
]

export const usRows: MarketRow[] = [
  { name: 'S&P 500', value: '5.912 pts', month: 2.1, year: 12.6, trend: 'Alta' },
  { name: 'Nasdaq', value: '19.114 pts', month: 3.8, year: 17.9, trend: 'Alta' },
  { name: 'Dow Jones', value: '42.270 pts', month: 0.9, year: 8.2, trend: 'Lateral' },
  { name: 'Treasury 10Y', value: '4,42%', month: 0.18, year: 0.21, trend: 'Alta' },
  { name: 'Fed Funds', value: '4,50%', month: 0, year: -1, trend: 'Lateral' },
  { name: 'Inflação EUA', value: '2,9%', month: 0.2, year: -0.4, trend: 'Queda' },
  { name: 'DXY', value: '103,4', month: 1.2, year: -0.7, trend: 'Lateral' },
]

export const globalRows: MarketRow[] = [
  { name: 'Bitcoin', value: 'US$ 104.280', month: 8.7, year: 62.5, trend: 'Alta' },
  { name: 'Ouro', value: 'US$ 3.284', month: 3.1, year: 28.4, trend: 'Alta' },
  { name: 'Petróleo Brent', value: 'US$ 65,40', month: -4.8, year: -18.2, trend: 'Queda' },
  { name: 'Minério de ferro', value: 'US$ 99,80', month: -1.4, year: -12.6, trend: 'Queda' },
  { name: 'MSCI World', value: '3.842 pts', month: 2.3, year: 11.8, trend: 'Alta' },
  { name: 'MSCI Emerging', value: '1.162 pts', month: 1.1, year: 7.5, trend: 'Lateral' },
]

export const assetPulse: AssetPulse[] = [
  { region: 'WORLD', name: 'BTC', valuation: 'Esticado', change: 'Acima da média histórica', accent: '#D99032', summary: 'Fluxo institucional segue forte; volatilidade aumentou perto das máximas.' },
  { region: 'WORLD', name: 'ETFs globais', valuation: 'Neutro', change: 'Próximo da média', accent: '#6E8FAD', summary: 'Índices globais avançam, mas concentração em tecnologia pede seletividade.' },
  { region: 'BR', name: 'Ações brasileiras', valuation: 'Descontado', change: 'Abaixo da média histórica', accent: '#7A9B76', summary: 'Múltiplos ainda baixos; juros domésticos seguem como principal trava.' },
  { region: 'US', name: 'Ações EUA', valuation: 'Esticado', change: 'Acima da média', accent: '#607D9A', summary: 'Resultados sustentam preços, embora valuations estejam acima da média.' },
  { region: 'US', name: 'Treasuries', valuation: 'Neutro', change: 'Prêmio de prazo elevado', accent: '#8B5E34', summary: 'Treasury de 10 anos oferece carrego, mas segue sensível à inflação e ao Fed.' },
  { region: 'US', name: 'REITs', valuation: 'Descontado', change: 'Abaixo da média histórica', accent: '#7A9B76', summary: 'Juros altos pressionam preços, enquanto segmentos defensivos mantêm renda.' },
  { region: 'BR', name: 'FIIs', valuation: 'Descontado', change: 'Desconto patrimonial', accent: '#A67C52', summary: 'Desconto patrimonial persiste; fundos de papel ainda capturam CDI alto.' },
  { region: 'BR', name: 'Renda fixa', valuation: 'Neutro', change: 'Carrego elevado', accent: '#8B5E34', summary: 'Pós-fixados continuam fortes; prefixados ganham assimetria se a inflação ceder.' },
  { region: 'BR', name: 'Tesouro Direto', valuation: 'Neutro', change: 'Taxas reais atrativas', accent: '#C8923B', summary: 'IPCA+ segue volátil, com taxas reais historicamente atrativas.' },
  { region: 'BR', name: 'Previdência', valuation: 'Neutro', change: 'Horizonte longo', accent: '#8570A6', summary: 'Fundos multimercado melhoraram, mas custo e consistência seguem decisivos.' },
  { region: 'WORLD', name: 'Ouro', valuation: 'Esticado', change: 'Próximo das máximas', accent: '#C8923B', summary: 'Compras de bancos centrais sustentam a tendência, mas o preço já incorpora proteção elevada.' },
  { region: 'WORLD', name: 'Emergentes', valuation: 'Descontado', change: 'Desconto versus desenvolvidos', accent: '#4F8A78', summary: 'Múltiplos atraentes convivem com dólar forte e crescimento chinês irregular.' },
]

export const news = [
  { region: 'US', tag: 'EUA', title: 'Juros americanos permanecem altos por mais tempo', summary: 'Dados de atividade resilientes reduziram a pressa do Fed e elevaram os Treasuries longos.', impact: 'Dólar forte e maior exigência sobre ações de crescimento.' },
  { region: 'BR', tag: 'BRASIL', title: 'Mercado reprecifica o ciclo da Selic', summary: 'Inflação de serviços e risco fiscal mantiveram a curva doméstica pressionada durante maio.', impact: 'Pós-fixados favorecidos; FIIs e small caps seguem sensíveis.' },
  { region: 'US', tag: 'TECNOLOGIA', title: 'IA continua puxando investimentos', summary: 'Capex de grandes empresas sustentou semicondutores e infraestrutura digital.', impact: 'Nasdaq liderou, ampliando a concentração dos índices.' },
  { region: 'WORLD', tag: 'COMMODITIES', title: 'Petróleo e minério perderam força', summary: 'Oferta confortável e sinais mistos da China pesaram sobre matérias-primas.', impact: 'Pressão sobre exportadoras, com efeito desinflacionário marginal.' },
  { region: 'WORLD', tag: 'CHINA', title: 'Atividade chinesa segue irregular', summary: 'Estímulos sustentaram setores pontuais, mas consumo e mercado imobiliário continuaram frágeis.', impact: 'Emergentes avançaram com cautela e commodities perderam tração.' },
]

export const portfolioImpacts = [
  { region: 'US', title: 'Exposição internacional', tone: 'Positivo', text: 'ETFs dos EUA capturam a alta dos índices e a valorização do dólar, mas elevam a concentração em tecnologia.' },
  { region: 'BR', title: 'Renda fixa brasileira', tone: 'Positivo', text: 'CDI alto sustenta o carrego. Títulos longos exigem tolerância à volatilidade da curva.' },
  { region: 'BR', title: 'Renda variável Brasil', tone: 'Atenção', text: 'Valuation oferece margem, porém a sensibilidade a juros e fiscal continua elevada.' },
  { region: 'WORLD', title: 'Diversificadores', tone: 'Neutro', text: 'Ouro e BTC protegem cenários distintos, mas ambos chegam ao mês com movimentos fortes.' },
  { region: 'WORLD', title: 'Mercados emergentes', tone: 'Atenção', text: 'Valuations são mais baixos, porém China, dólar e commodities ainda limitam a convicção.' },
]
