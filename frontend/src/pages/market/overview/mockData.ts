/** Fictional, internally consistent edition. No live quotes or actual news. */
export type Region = 'br' | 'world'
export type Period = 'week' | 'month' | 'year'
export interface Detail {
  title: string
  label: string
  summary: string
  sections: { title: string; text: string }[]
}
export interface Market extends Detail {
  id: string
  region: Region
  value: string
  changes: Record<Period, number>
  unit?: 'pp'
}
export const PERIODS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: '12 meses' },
]
export const PERIOD_LABEL: Record<Period, string> = {
  week: 'Na semana',
  month: 'No mês',
  year: 'Em 12 meses',
}
export const markets: Market[] = [
  {
    id: 'usd',
    title: 'Dólar',
    label: 'Câmbio · USD/BRL',
    region: 'world',
    value: 'R$ 5,68',
    changes: { week: 0.6, month: 2.4, year: 7.8 },
    summary: 'O dólar ganhou força enquanto os juros americanos permaneceram elevados.',
    sections: [
      {
        title: 'O que explica o movimento',
        text: 'A revisão das expectativas de juros nos EUA sustentou a moeda americana. No Brasil, a percepção fiscal também influenciou o câmbio.',
      },
      {
        title: 'O que observar',
        text: 'A próxima leitura de inflação americana e a diferença entre os juros brasileiros e americanos. Uma mudança nessas expectativas pode alterar o movimento.',
      },
      {
        title: 'Como ler este número',
        text: 'Preço de um dólar em reais. A variação positiva representa valorização do dólar, sem indicar se isso é favorável a uma carteira específica.',
      },
    ],
  },
  {
    id: 'btc',
    title: 'Bitcoin',
    label: 'Cripto · BTC/USD',
    region: 'world',
    value: 'US$ 104.280',
    changes: { week: 3.2, month: 8.7, year: 62.5 },
    summary: 'Bitcoin liderou a alta entre os mercados acompanhados, com oscilações maiores.',
    sections: [
      {
        title: 'O que explica o movimento',
        text: 'O movimento combina interesse institucional e maior demanda por exposição a cripto. A alta de preço, por si só, não demonstra uma mudança de valor fundamental.',
      },
      {
        title: 'O que pode mudar',
        text: 'Reversão dos fluxos, mudanças regulatórias ou menor liquidez podem interromper o movimento. O caminho até um cenário favorável pode incluir quedas acentuadas.',
      },
      {
        title: 'Como comparar',
        text: 'A cotação e os retornos são em dólares. A variação em reais também depende do câmbio.',
      },
    ],
  },
  {
    id: 'cdi',
    title: 'CDI',
    label: 'Brasil · referência de juros',
    region: 'br',
    value: '14,65% a.a.',
    changes: { week: 0.26, month: 1.1, year: 11.2 },
    summary:
      'O rendimento acumulado do CDI mantém uma referência elevada para o mercado brasileiro.',
    sections: [
      {
        title: 'Taxa e rendimento são diferentes',
        text: '14,65% a.a. é a taxa anualizada ilustrativa. As variações do gráfico representam o rendimento acumulado no período, e não a mudança dessa taxa.',
      },
      {
        title: 'Por que acompanhar',
        text: 'O CDI ajuda a contextualizar o retorno de outros investimentos. A comparação deve considerar prazo, tributação, liquidez e risco.',
      },
      {
        title: 'Próximo ponto de atenção',
        text: 'A sinalização do Copom e a trajetória da inflação podem alterar as expectativas para os próximos meses.',
      },
    ],
  },
  {
    id: 'ibov',
    title: 'Ibovespa',
    label: 'Brasil · ações',
    region: 'br',
    value: '137.420 pts',
    changes: { week: -0.4, month: 1.8, year: 8.4 },
    summary: 'A bolsa brasileira avançou no mês, mas perdeu força na última semana.',
    sections: [
      {
        title: 'Por trás do índice',
        text: 'Bancos sustentam parte da alta, enquanto exportadoras sentem a fraqueza de commodities. A variação do índice não descreve todos os setores.',
      },
      {
        title: 'O que observar',
        text: 'Revisões de lucro, juros longos e notícias fiscais. Uma melhora de preços sem melhora de resultados pode ter uma sustentação diferente.',
      },
    ],
  },
  {
    id: 'ifix',
    title: 'IFIX',
    label: 'Brasil · fundos imobiliários',
    region: 'br',
    value: '3.425 pts',
    changes: { week: 0.3, month: 0.7, year: 6.1 },
    summary: 'FIIs tiveram recuperação moderada, ainda sob influência dos juros.',
    sections: [
      {
        title: 'Uma classe, diferentes exposições',
        text: 'Fundos de imóveis e fundos de crédito respondem a fatores diferentes. Ocupação, qualidade do crédito e indexadores ajudam a aprofundar a leitura.',
      },
      {
        title: 'O que observar',
        text: 'A curva de juros, os relatórios dos fundos e a recorrência dos rendimentos. Desconto patrimonial isolado não determina atratividade.',
      },
    ],
  },
  {
    id: 'sp500',
    title: 'S&P 500',
    label: 'Estados Unidos · ações',
    region: 'world',
    value: '5.912 pts',
    changes: { week: 1.1, month: 2.1, year: 12.6 },
    summary: 'Resultados corporativos sustentaram a alta, com participação desigual entre setores.',
    sections: [
      {
        title: 'O que há além da alta',
        text: 'Poucas empresas grandes explicam uma parcela relevante do avanço. A amplitude da alta ajuda a avaliar se o movimento está se espalhando.',
      },
      {
        title: 'O que observar',
        text: 'Crescimento dos lucros, margens e custo de financiamento. Uma expectativa elevada de lucro também aumenta a exigência sobre os próximos resultados.',
      },
    ],
  },
  {
    id: 'nasdaq',
    title: 'Nasdaq',
    label: 'Estados Unidos · ações',
    region: 'world',
    value: '19.114 pts',
    changes: { week: 1.7, month: 3.8, year: 17.9 },
    summary: 'Tecnologia puxou o desempenho, apoiada por expectativas de investimento em IA.',
    sections: [
      {
        title: 'A pergunta por trás da narrativa',
        text: 'O investimento em infraestrutura digital está se traduzindo em receita e margens? Essa diferença entre expectativa e execução está no centro da leitura.',
      },
      {
        title: 'O que observar',
        text: 'Resultados, projeções de investimento e concentração do índice. Mudanças nos juros também podem afetar o preço atribuído ao crescimento futuro.',
      },
    ],
  },
  {
    id: 'gold',
    title: 'Ouro',
    label: 'Global · commodities',
    region: 'world',
    value: 'US$ 3.284/oz',
    changes: { week: -0.8, month: 3.1, year: 28.4 },
    summary: 'O ouro acumulou alta no mês, apesar de uma realização recente.',
    sections: [
      {
        title: 'Fatores em disputa',
        text: 'O cenário combina demanda por proteção e juros reais elevados. São forças que podem atuar em direções opostas.',
      },
      {
        title: 'O que observar',
        text: 'Juros reais, câmbio e demanda institucional. A cotação é por onça-troy, em dólares.',
      },
    ],
  },
  {
    id: 'oil',
    title: 'Petróleo Brent',
    label: 'Global · commodities',
    region: 'world',
    value: 'US$ 65,40/barril',
    changes: { week: -2.1, month: -4.8, year: -18.2 },
    summary: 'Petróleo recuou em um ambiente de oferta confortável e demanda incerta.',
    sections: [
      {
        title: 'Efeito em cadeia',
        text: 'Preços menores pressionam a receita de produtoras e aliviam parte dos custos de transporte. O efeito varia conforme o setor e o câmbio.',
      },
      {
        title: 'O que observar',
        text: 'Decisões de produção, estoques e atividade econômica. Choques de oferta podem mudar rapidamente esse equilíbrio.',
      },
    ],
  },
  {
    id: 'europe',
    title: 'Euro Stoxx 50',
    label: 'Europa · ações em EUR',
    region: 'world',
    value: '5.360 pts',
    changes: { week: 0.4, month: 1.3, year: 9.2 },
    summary: 'Ações europeias avançam em ritmo moderado, com atenção ao crescimento e ao crédito.',
    sections: [
      {
        title: 'Por trás do índice',
        text: 'Bancos e empresas industriais respondem de maneiras diferentes à perspectiva de juros menores. O índice reúne grandes empresas da zona do euro.',
      },
      {
        title: 'O que observar',
        text: 'Atividade, inflação e resultados das exportadoras. Mudanças no euro também influenciam empresas com receitas internacionais.',
      },
    ],
  },
  {
    id: 'china',
    title: 'CSI 300',
    label: 'China · ações em CNY',
    region: 'world',
    value: '3.850 pts',
    changes: { week: -0.7, month: -1.6, year: 4.2 },
    summary: 'A bolsa chinesa recua enquanto estímulos ainda procuram tração na economia.',
    sections: [
      {
        title: 'O que explica o movimento',
        text: 'Consumo e mercado imobiliário seguem como pontos de atenção. Medidas de estímulo convivem com uma recuperação desigual entre setores.',
      },
      {
        title: 'O que observar',
        text: 'Vendas no varejo, crédito e atividade industrial. O efeito sobre a demanda de commodities também conecta esse cenário ao Brasil.',
      },
    ],
  },
]

export interface Story extends Detail {
  id: string
  region: Region
  tag: string
  time: string
  related: string[]
}
export const stories: Story[] = [
  {
    id: 'rates',
    region: 'world',
    tag: 'JUROS GLOBAIS',
    time: '29 mai · 16h',
    title: 'A pressa por cortes de juros diminuiu',
    label: 'Tema da edição',
    summary:
      'Atividade resiliente nos EUA mantém o custo do dinheiro no centro da conversa. O efeito atravessa moedas, bolsas e títulos.',
    related: ['usd', 'sp500', 'gold'],
    sections: [
      {
        title: 'O que aconteceu',
        text: 'Uma leitura de atividade acima das expectativas levou participantes a rever o ritmo esperado de cortes de juros. ',
      },
      {
        title: 'A leitura',
        text: 'Juros elevados por mais tempo podem sustentar o dólar e aumentar a exigência sobre o crescimento de lucros. Isso não implica que todos os ativos de risco caiam juntos.',
      },
      {
        title: 'O contraponto',
        text: 'Atividade forte também pode apoiar resultados corporativos. A interpretação depende de quanto desse cenário já está refletido nos preços.',
      },
      {
        title: 'Próxima evidência',
        text: 'Inflação, emprego e a comunicação do banco central. O conjunto importa mais do que uma divulgação isolada.',
      },
    ],
  },
  {
    id: 'brazil',
    region: 'br',
    tag: 'BRASIL',
    time: '29 mai · 14h',
    title: 'O juro alto ainda organiza o mercado brasileiro',
    label: 'Cenário doméstico',
    summary:
      'Renda fixa mantém uma referência forte. Bolsa e FIIs procuram sinais de alívio na inflação e nos juros longos.',
    related: ['cdi', 'ibov', 'ifix'],
    sections: [
      {
        title: 'O que aconteceu',
        text: 'A curva de juros permaneceu elevada após uma leitura persistente de inflação de serviços. ',
      },
      {
        title: 'Por que importa',
        text: 'O custo de financiamento e a taxa usada para avaliar fluxos futuros influenciam empresas e fundos. Os efeitos variam conforme endividamento e indexadores.',
      },
      {
        title: 'O contraponto',
        text: 'Uma parte da incerteza pode já estar nos preços. Inflação mais baixa ou melhora fiscal poderia alterar a leitura mesmo antes de um corte da taxa básica.',
      },
    ],
  },
  {
    id: 'ai',
    region: 'world',
    tag: 'EMPRESAS',
    time: '28 mai · 18h',
    title: 'Tecnologia avança; a pergunta passa a ser sobre retorno',
    label: 'Resultados e investimento',
    summary:
      'O investimento em IA sustenta expectativas, mas aumenta a cobrança por geração de receita.',
    related: ['nasdaq', 'sp500'],
    sections: [
      {
        title: 'O que aconteceu',
        text: 'Empresas ampliaram planos de investimento em infraestrutura digital. O debate destaca a distância entre gastar mais e obter retorno sobre esse capital.',
      },
      {
        title: 'Por que importa',
        text: 'Fornecedores e clientes podem ter exposições diferentes ao mesmo ciclo. Uma narrativa comum não significa resultados iguais.',
      },
      {
        title: 'O que acompanhar',
        text: 'Receita incremental, margens, contratos e projeções de investimento nos próximos resultados.',
      },
    ],
  },
  {
    id: 'commodities',
    region: 'world',
    tag: 'ECONOMIA GLOBAL',
    time: '28 mai · 10h',
    title: 'Commodities mostram um mundo em ritmos diferentes',
    label: 'Oferta e demanda',
    summary: 'A queda do petróleo contrasta com a alta do ouro e a força de parte das bolsas.',
    related: ['oil', 'gold', 'ibov'],
    sections: [
      {
        title: 'O que aconteceu',
        text: 'Petróleo recuou e ouro avançou no mês. Os movimentos em direções opostas mostram por que um único termômetro de mercado seria insuficiente.',
      },
      {
        title: 'A leitura',
        text: 'Demanda industrial, oferta e procura por proteção contam histórias diferentes. Exportadoras e importadoras podem sentir efeitos opostos.',
      },
      {
        title: 'Próximo ponto de atenção',
        text: 'Indicadores de atividade chinesa e decisões de produção de petróleo.',
      },
    ],
  },
  {
    id: 'flows',
    region: 'world',
    tag: 'CRIPTO',
    time: '29 mai · 11h',
    title: 'Bitcoin sobe e coloca os fluxos no centro da atenção',
    label: 'Liquidez e participação',
    summary:
      'A demanda por exposição a cripto acelera. A questão é quanto desse movimento se sustenta se a liquidez mudar.',
    related: ['btc', 'usd'],
    sections: [
      {
        title: 'O que aconteceu',
        text: 'A procura por produtos de investimento em Bitcoin cresceu no período, acompanhada de aumento nas oscilações de preço.',
      },
      {
        title: 'Por que importa',
        text: 'Fluxos ajudam a contextualizar o movimento, mas podem mudar rapidamente. A leitura precisa separar uma entrada pontual de uma mudança persistente na demanda.',
      },
      {
        title: 'O contraponto',
        text: 'Uma sequência de altas não elimina riscos de reversão. Vale observar volume, liquidez e a concentração dos participantes.',
      },
    ],
  },
  {
    id: 'regions',
    region: 'world',
    tag: 'EUROPA E CHINA',
    time: '27 mai · 15h',
    title: 'Fora dos EUA, a recuperação segue desigual',
    label: 'Crescimento global',
    summary:
      'Europa avança com cautela; na China, a resposta aos estímulos continua irregular. Os dois movimentos ajudam a explicar a demanda por commodities.',
    related: ['europe', 'china', 'oil', 'gold'],
    sections: [
      {
        title: 'O que aconteceu',
        text: 'Os indicadores europeus apontaram estabilidade, enquanto a atividade chinesa alternou sinais de melhora e fraqueza.',
      },
      {
        title: 'Conexão com o Brasil',
        text: 'A demanda externa influencia exportadoras, commodities e câmbio. É possível ter alta em uma bolsa e fraqueza em um setor exportador ao mesmo tempo.',
      },
      {
        title: 'O que observar',
        text: 'Consumo, indústria e crédito, junto das revisões de resultados corporativos. Estímulos anunciados precisam ser acompanhados de sinais de efeito na atividade.',
      },
    ],
  },
]

export interface Scenario extends Detail {
  id: string
  horizon: string
  trigger: string
  counter: string
  affected: string
}
export const scenarios: Scenario[] = [
  {
    id: 'base',
    title: 'Desaceleração gradual',
    label: 'Cenário de referência',
    horizon: 'Próximos 3–6 meses',
    summary:
      'Inflação cede aos poucos; juros permanecem restritivos, enquanto lucros sustentam parte dos mercados.',
    trigger: 'Inflação perde força sem uma queda brusca da atividade.',
    counter: 'Serviços e salários voltam a acelerar.',
    affected: 'Juros, dólar e ações',
    sections: [
      {
        title: 'Brasil',
        text: 'O debate se deslocaria para a duração do juro alto. A evolução fiscal e a inflação de serviços continuariam condicionando os juros longos.',
      },
      {
        title: 'Mundo',
        text: 'Resultados corporativos ganhariam importância em um mercado menos dependente de cortes rápidos de juros.',
      },
      {
        title: 'Como acompanhar',
        text: 'Observar a sequência de divulgações de inflação, atividade e revisões de lucros. Esta hipótese não contém uma previsão de preço nem uma probabilidade calculada.',
      },
    ],
  },
  {
    id: 'relief',
    title: 'Alívio mais rápido',
    label: 'Alternativa favorável ao risco',
    horizon: 'Próximos 3–6 meses',
    summary:
      'Inflação surpreende para baixo e abre espaço para condições financeiras menos restritivas.',
    trigger: 'Queda disseminada da inflação, com atividade estável.',
    counter: 'Inflação cai porque a atividade piorou muito.',
    affected: 'Bolsa, FIIs e títulos longos',
    sections: [
      {
        title: 'Brasil',
        text: 'Juros longos poderiam recuar. A resposta de empresas e fundos dependeria também dos lucros, qualidade dos ativos e expectativas já incorporadas.',
      },
      {
        title: 'Mundo',
        text: 'Menor pressão dos juros poderia ampliar a participação de setores na alta das bolsas.',
      },
      {
        title: 'O que invalidaria a leitura',
        text: 'Uma recessão mais forte pode prejudicar lucros e crédito, mesmo com juros menores. Queda de juros não é sinônimo automático de alta de ativos.',
      },
    ],
  },
  {
    id: 'stress',
    title: 'Inflação volta a incomodar',
    label: 'Risco a monitorar',
    horizon: 'Próximos 3–6 meses',
    summary: 'Um choque de oferta ou inflação persistente adia o alívio esperado nos juros.',
    trigger: 'Inflação e expectativas sobem em conjunto.',
    counter: 'O choque se dissipa sem contaminar outros preços.',
    affected: 'Câmbio, crédito e crescimento',
    sections: [
      {
        title: 'Brasil',
        text: 'A pressão cambial e a inflação poderiam dificultar o alívio dos juros, com efeitos diferentes sobre pós-fixados e títulos longos.',
      },
      {
        title: 'Mundo',
        text: 'Juros mais altos poderiam elevar a volatilidade e a exigência sobre empresas endividadas ou dependentes de crescimento futuro.',
      },
      {
        title: 'O que acompanhar',
        text: 'Expectativas de inflação, preços de energia e comunicação dos bancos centrais. São sinais de acompanhamento, não gatilhos de negociação.',
      },
    ],
  },
]
export const agenda: (Detail & { day: string; month: string; region: Region })[] = [
  {
    day: '02',
    month: 'JUN',
    region: 'br',
    title: 'Atividade no Brasil',
    label: 'Agenda ilustrativa · terça-feira',
    summary: 'A economia está perdendo força ou segue resistente aos juros?',
    sections: [
      {
        title: 'O que observar',
        text: 'A composição entre consumo, investimento e setores. No cenário de referência, a atividade desacelera de maneira gradual.',
      },
      {
        title: 'Mercados relacionados',
        text: 'Bolsa brasileira e juros futuros. A data é fictícia e não representa um calendário oficial.',
      },
    ],
  },
  {
    day: '04',
    month: 'JUN',
    region: 'world',
    title: 'Inflação nos EUA',
    label: 'Agenda ilustrativa · quinta-feira',
    summary: 'Os preços confirmam a trajetória de desaceleração?',
    sections: [
      {
        title: 'O que observar',
        text: 'Núcleo, serviços e revisões dos meses anteriores. Uma surpresa deve ser lida junto das expectativas anteriores.',
      },
      {
        title: 'Mercados relacionados',
        text: 'Dólar, juros americanos e bolsas globais. A data é fictícia.',
      },
    ],
  },
  {
    day: '05',
    month: 'JUN',
    region: 'world',
    title: 'Mercado de trabalho americano',
    label: 'Agenda ilustrativa · sexta-feira',
    summary: 'Emprego e salários reforçam ou desafiam o cenário de juros?',
    sections: [
      {
        title: 'O que observar',
        text: 'Criação de empregos, salários e participação na força de trabalho, sem reduzir a leitura a um único número.',
      },
      { title: 'Mercados relacionados', text: 'Juros, câmbio e ações. A data é fictícia.' },
    ],
  },
]

export function signed(value: number, unit?: 'pp') {
  return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${unit ? ' p.p.' : '%'}`
}
/** Small illustrative paths; their first/last values agree with the displayed change. */
export function curve(market: Market, period: Period) {
  const change = market.changes[period]
  const seed = [...market.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return Array.from({ length: 16 }, (_, i) => ({
    date: `Ponto ${i + 1}`,
    value:
      100 +
      (change * i) / 15 +
      (market.id === 'cdi'
        ? 0
        : Math.sin(i * (0.7 + (seed % 9) / 8)) *
          Math.abs(change) *
          (0.12 + (seed % 5) / 20) *
          Math.sin((Math.PI * i) / 15)),
  }))
}

export const changeTone = (value: number) =>
  value > 0 ? ('success' as const) : value < 0 ? ('danger' as const) : ('secondary' as const)
