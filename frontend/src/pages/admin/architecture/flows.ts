/** Written documentation that sits next to the diagram.
 *
 * The map shows what talks to what; this explains why, and the rules that are
 * easy to break without noticing. Kept as data so the page stays presentation
 * only and the text is reviewable in a diff. */

export interface FlowStep {
  title: string
  detail: string
}

export interface Flow {
  id: string
  name: string
  trigger: string
  summary: string
  steps: FlowStep[]
  notes?: string[]
}

export const flows: Flow[] = [
  {
    id: 'quote-ingestion',
    name: 'Importação de cotações',
    trigger: 'Agendada 04:00 · ou manual em Integrações',
    summary:
      'Quem sabe quais ativos importam é a carteira; quem sabe buscar cotação é o market data. A tarefa agendada vive no portfolio e encadeia a de market data.',
    steps: [
      {
        title: 'ingest_quotes_for_held_assets (portfolio)',
        detail:
          'Seleciona os ativos com posição na janela recente, ou todos os que já tiveram operação quando o pedido é de histórico completo.',
      },
      {
        title: 'ingest_quotes (market_data)',
        detail:
          'Recebe os asset_ids prontos. Não decide quais ativos importar — é o que mantém o market data independente do portfolio.',
      },
      {
        title: 'Provider por tipo de ativo',
        detail:
          'Ação, BDR e ETF vão para /v2/stocks/historical; FII para /v2/fii/historical; cripto tenta CryptoCompare e cai para a Brapi se a cota recusar.',
      },
      {
        title: 'Moeda vem do provider',
        detail:
          'A moeda é lida de /v2/stocks/quote, não inferida da bolsa cadastrada. O palpite antigo tratava "sem bolsa" como brasileiro e gravou ETFs americanos em BRL.',
      },
      {
        title: 'Upsert por (asset_id, date)',
        detail:
          'Reimportar sobrescreve em vez de duplicar. Valores não finitos viram NULL antes de chegar ao banco.',
      },
    ],
    notes: [
      'A execução é rastreada em data_ingestion_execution com uma tentativa por ativo, e a tela de Integrações lê disso.',
      'A CryptoCompare tem cota de 100 chamadas por mês; ela só deve ser acionada quando a profundidade extra for necessária.',
    ],
  },
  {
    id: 'series-ingestion',
    name: 'Importação de séries e câmbio',
    trigger: 'Agendada 05:00, 13:00 e 21:00',
    summary:
      'Séries de mercado e a taxa USD/BRL são coisas distintas: a taxa tem tabela própria porque é primitivo de conversão, não referência de desempenho.',
    steps: [
      {
        title: 'CDI e IPCA',
        detail: 'Vêm do Banco Central. São taxas percentuais, não níveis de preço.',
      },
      {
        title: 'IFIX, S&P500, IBOVESPA, NASDAQ',
        detail:
          'Vêm da Brapi por /v2/stocks/historical. Dias sem pregão são preenchidos com o fechamento anterior.',
      },
      {
        title: 'USD/BRL',
        detail:
          'Vem do PTAX do Banco Central para usd_brl_history. A ingestão grava as duas direções, usd_brl e brl_usd, para que ninguém precise dividir.',
      },
    ],
    notes: [
      'USD/BRL não é uma market data series e não aparece na tabela de séries.',
      'A Brapi parou de servir histórico do IFIX: hoje ela devolve um único ponto, e o histórico salvo é o que sustenta os gráficos.',
    ],
  },
  {
    id: 'consolidation',
    name: 'Consolidação de posições',
    trigger: 'Agendada 05:05, 13:05 e 21:05 · ou manual em Consolidação',
    summary:
      'Reconstrói a série diária de posições a partir do que está no banco. Não busca nada em provider.',
    steps: [
      {
        title: 'Lê do banco',
        detail:
          'Operações, eventos corporativos, cotações persistidas, taxa de câmbio e proventos. Nenhuma chamada externa nesse caminho.',
      },
      {
        title: 'Converte para BRL e USD',
        detail:
          'Preço em moeda estrangeira é multiplicado por usd_brl; o inverso usa brl_usd. A taxa é repetida em dias sem publicação.',
      },
      {
        title: 'Recalcula a série inteira do ativo',
        detail:
          'Quantidade, preço médio, total investido e retornos, da primeira operação até hoje.',
      },
      {
        title: 'Invalida o cache derivado',
        detail:
          'A evolução patrimonial é apagada do cache. Nada é pré-aquecido: a próxima leitura preenche no miss.',
      },
    ],
    notes: [
      'Um ativo cuja operação antecede a primeira cotação falha com erro nomeando o ativo e o intervalo, em vez de gravar posição sem preço.',
      'A consolidação incremental cobre a janela recente; para refazer tudo use recalcular todas as posições.',
    ],
  },
  {
    id: 'reads',
    name: 'Leitura de cotações na tela',
    trigger: 'Ao abrir um ativo em Mercado',
    summary:
      'O banco é a fonte preferida. O provider só entra para ativos que nunca foram importados.',
    steps: [
      {
        title: 'Banco primeiro',
        detail:
          'Se o ativo tem histórico persistido, ele responde. É instantâneo e não gasta cota de provider.',
      },
      {
        title: 'Provider como fallback',
        detail:
          'Ativos nunca importados — a maior parte do catálogo — são buscados na hora, com cache de 2 minutos.',
      },
      {
        title: 'Logo à parte',
        detail:
          'A arte do ativo é uma leitura própria, cacheada por 24h, para não sumir quando as cotações vêm do banco.',
      },
    ],
    notes: ['A resposta traz o campo source, com database ou provider, para auditoria.'],
  },
]

export interface ModuleRule {
  name: string
  role: string
  rules: string[]
}

export const moduleRules: ModuleRule[] = [
  {
    name: 'Market Data',
    role: 'Cotações, séries de mercado, câmbio e o catálogo de ativos.',
    rules: [
      'Não importa nada de portfolio nem de ai — um contrato de import-linter trava isso.',
      'Ingere os ativos que recebe; escolher quais é responsabilidade de quem sabe o porquê.',
      'Provedores ficam confinados aos adapters; o formato de cada vendor não vaza para o serviço.',
    ],
  },
  {
    name: 'Portfolio',
    role: 'Operações, posições, retornos, categorias e imposto de renda.',
    rules: [
      'Pode depender do market data; o contrário é proibido.',
      'A consolidação lê cotações do banco, nunca de provider.',
      'A tarefa agendada de cotações vive aqui, porque a seleção de ativos é conhecimento de carteira.',
    ],
  },
  {
    name: 'Persistência',
    role: 'Acesso ao banco por todos os serviços.',
    rules: [
      'UnitOfWork é a única porta; nenhum serviço recebe repositório direto.',
      'Um escopo por caso de uso. Leitura entra e sai; escrita chama commit antes de sair.',
      'Sem commit, o trabalho é descartado na saída do escopo.',
    ],
  },
  {
    name: 'Cache',
    role: 'Acelerar leituras derivadas.',
    rules: [
      'Não existe job de aquecimento. A leitura preenche no miss.',
      'A escrita invalida o que derivou dela.',
      'Cache nunca é fonte de verdade.',
    ],
  },
]
