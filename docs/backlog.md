# Backlog

## 1. Refatorar índices e generalizar a ingestão de dados de mercado

### Objetivo

Substituir as duas tabelas atuais, `Index` e `IndexHistory`, por duas novas
entidades/tabelas: `MarketDataSeries`, que identifica e tipa a série, e
`MarketDataSeriesHistory`, que armazena seu histórico. Permitir a persistência
independente de três conjuntos de dados:

- cotações de ativos (`Quote`);
- séries de mercado, como IPCA, CDI e índices (`MarketDataSeries` e
  `MarketDataSeriesHistory`);
- câmbio USD/BRL em tabela própria, incluindo conversões BRL → USD e USD → BRL.

Generalizar o acompanhamento das execuções de ingestão para atender os três
tipos sem criar uma tabela de execução para cada um, permitindo filtrar e
apresentar cada tipo separadamente no frontend.

### Escopo

- [x] Mapear todos os usos atuais de `Index`, `IndexHistory`, consolidação de
      índices, USD/BRL e registros de execução de ingestão.
- [x] Definir os tipos de `MarketDataSeries` e o tipo discriminador das
      ingestões: `quote`, `market_data_series` e `usd_brl`.
- [x] Definir unidade, frequência e formato dos pontos de cada série, evitando
      tratar séries escalares como se fossem necessariamente OHLC.
- [x] Substituir as tabelas `Index` e `IndexHistory` pelas tabelas
      `MarketDataSeries` e `MarketDataSeriesHistory`, respectivamente,
      preservando os dados existentes por migration.
- [x] Criar uma tabela exclusiva para o histórico USD/BRL, com constraints e
      precisão adequadas, preservando ou migrando o histórico existente.
- [x] Disponibilizar conversões BRL → USD e USD → BRL a partir do histórico
      persistido, definindo a direção canônica da taxa e o comportamento para
      datas sem cotação exata.
- [x] Generalizar `QuoteIngestionExecution` e `QuoteIngestionAttempt` para
      registrar execuções e tentativas dos três tipos de ingestão na mesma
      estrutura, discriminadas por tipo.
- [x] Preservar histórico, retenção, status, parâmetros, tentativas, erros,
      totais e idempotência das execuções durante a generalização.
- [x] Definir se o bloqueio de execuções concorrentes é global ou independente
      por tipo de ingestão.
- [x] Preservar sucesso parcial, erro e possibilidade de nova tentativa por ID,
      sem invalidar os itens concluídos na mesma execução.
- [x] Fazer cada ingestão receber uma lista de IDs, de forma análoga à ingestão
      atual de `Quote`.
- [x] Criar rotas distintas para disparar e consultar a consolidação de
      `Quote`, `MarketDataSeries` e USD/BRL, reutilizando o acompanhamento
      genérico de execução.
- [x] Separar services de leitura e escrita; escritas recebem somente `uow`, e
      leituras usam repositories e cache quando necessário.
- [x] Manter transformação pesada, preenchimento de calendário e cálculos fora
      da ingestão.
- [x] Remover `_extend_indexes_to_today` e qualquer preenchimento de datas do
      fluxo de escrita; aplicar essas transformações somente na leitura ou no
      domínio apropriado.
- [x] Manter services de ingestão responsáveis apenas por orquestrar seleção,
      provider, normalização mínima, persistência e acompanhamento da execução.
- [x] Atualizar o frontend administrativo para filtrar e exibir execuções por
      tipo, preservando disparo manual, polling e apresentação de erros.
- [x] Criar três páginas administrativas distintas para ingestão de `Quote`,
      `MarketDataSeries` e USD/BRL, compartilhando componentes apenas quando
      isso reduzir duplicação sem misturar as responsabilidades.
- [x] Preservar os contratos HTTP atuais durante a migração ou documentar e
      adaptar explicitamente cada quebra necessária no backend e frontend.
- [x] Adicionar testes de domínio, repositories, services, migrations, rotas e
      compatibilidade dos fluxos existentes.
- [x] Rodar os testes arquiteturais e garantir que as novas rotas não importem
      repository, SQLAlchemy, UoW, Redis ou providers diretamente.
- [x] Validar que cálculos, gráficos, relatórios, consolidações de carteira e
      caches que hoje dependem de índices ou USD/BRL preservam o comportamento.
- [x] Rodar o schema diff do Alembic e confirmar que somente as mudanças físicas
      planejadas aparecem na migration.

## 2. Substituir o caminho legado de consulta de cotações

### Objetivo

Remover do fluxo de `Quote` o contrato legado de consulta ao provedor e usar
somente o contrato atual, mantendo detalhes de endpoint, versão e payload fora
da API, dos services e do domínio de `market_data`.

### Escopo

- [x] Mapear os consumidores do caminho legado
      `route -> QuoteService.get_asset_quotes() ->
      MarketDataProvider.get_asset_quotes()` e registrar o contrato HTTP que
      precisa ser preservado ou migrado.
- [x] Fazer a consulta de cotações usar o contrato normalizado
      `MarketDataProvider.fetch_quotes()`, que retorna `FetchedQuotes` e
      `Quote`, sem expor o payload do provedor.
- [x] Confirmar e testar a estratégia atual por tipo de ativo, incluindo ao
      menos ações, ETFs, FIIs e criptoativos.
- [x] Remover `QuoteService.get_asset_quotes()`,
      `MarketDataProvider.get_asset_quotes()` e os handlers legados quando não
      houver mais consumidores.
- [x] Remover do client de integração apenas os métodos ligados ao endpoint
      legado que ficarem sem uso; preservar o client e as operações atuais.
- [x] Montar service, provider e ciclo de vida do client em `composition`, sem
      instanciar `UnitOfWork` ou infraestrutura na rota.
- [x] Atualizar schemas, consumidores do frontend e testes sem introduzir o
      nome ou a versão do provedor no contrato público.
- [x] Rodar testes funcionais e arquiteturais e confirmar que a consulta não
      persiste dados nem altera o comportamento de ingestão.

## 3. Separar cotações persistidas de cotações sob demanda

### Objetivo

Disponibilizar duas capacidades de leitura explícitas em `market_data`: uma
consulta ao histórico persistido, usada por carteiras e cálculos internos, e
uma consulta sob demanda ao provedor, usada para pesquisa e páginas públicas
sem exigir cadastro do ativo nem gravar seu histórico no banco.

### Escopo

- [x] Criar `GET /market_data/quotes/persisted` para consultar somente o banco,
      por IDs ou tickers de ativos cadastrados, sem chamar integrações
      externas.
- [x] Criar `GET /market_data/quotes/on-demand` para consultar o provedor por
      ticker, tipo de ativo e exchange quando aplicável, sem consultar ou
      persistir `Asset` e `Quote`.
- [x] Não chamar a segunda rota de `live` ou `real-time` enquanto o provedor
      não oferecer e o produto não definir essa garantia de atualização;
      `on-demand` descreve o comportamento sem prometer uma latência do dado.
- [x] Separar os services de leitura persistida e leitura sob demanda para que
      cada um receba somente suas dependências: repository no primeiro e
      provider no segundo.
- [x] Definir schemas de resposta coerentes em torno de `Quote`, preservando a
      diferença necessária entre identidade interna (`asset_id`) e consulta
      externa (`ticker`, tipo e exchange).
- [x] Definir limites de período, quantidade de tickers, concorrência, timeout
      e tratamento de indisponibilidade da consulta sob demanda.
- [x] Definir se "página pública" significa apenas um ativo fora da carteira
      ou acesso sem autenticação; no segundo caso, separar a rota do router
      autenticado atual e aplicar rate limit para proteger custo e quota do
      provedor.
- [x] Aplicar cache temporário somente à consulta sob demanda se as medições
      mostrarem necessidade, com chave que inclua todos os parâmetros e TTL
      compatível com a frequência dos dados.
- [x] Atualizar os consumidores existentes para escolher explicitamente a
      origem adequada e remover a rota ambígua anterior após a migração.
- [x] Cobrir as duas rotas com testes que provem a fronteira: a persistida não
      chama o provider e a sob demanda não acessa repository, UoW ou banco.
- [x] Rodar testes funcionais e arquiteturais e conferir que nenhuma rota
      recebe SQLAlchemy, repository, UoW, Redis ou provider diretamente.

## 4. Corrigir os testes arquiteturais de `market_data`

### Objetivo

Fazer o módulo `market_data` cumprir e validar isoladamente as fronteiras
arquiteturais documentadas, sem enfraquecer contratos, adicionar exceções para
o código atual ou depender da correção prévia dos demais módulos.

### Escopo

- [x] Registrar o baseline do `import-linter`. Em 08/08/2026, os contratos
      globais têm 4 resultados mantidos e 3 quebrados; em `market_data`, as
      violações atualmente reportadas são imports de `UnitOfWork` em
      `api/asset/router.py`, `api/broker/router.py` e `api/quote/router.py`.
- [x] Criar contratos identificáveis e executáveis isoladamente para as
      fronteiras de domain, service, API, tasks e cross-module de
      `market_data`, mantendo-os no `import-linter` já adotado pelo projeto.
- [x] Disponibilizar um comando de arquitetura do módulo usando
      `lint-imports --contract`, sem duplicar a configuração em outra
      ferramenta.
- [x] Fortalecer o contrato da API para impedir todo acesso direto a
      `app.infra.db`, repositories, UoW, SQLAlchemy, Redis, adapters/providers e
      tasks; a regra atual detecta `unit_of_work`, mas deixa passar
      `infra.db.dependencies` e `infra.db.repositories`.
- [x] Fazer as rotas de assets e brokers receberem services montados por
      providers de `composition`, removendo `get_repository`,
      `SQLAlchemyRepository`, `get_uow` e `UnitOfWork` das rotas e de suas
      assinaturas.
- [x] Fazer as rotas de quotes receberem o service por `composition`, incluindo
      o ciclo de vida do provider, sem instanciar `UnitOfWork` ou integração na
      rota.
- [x] Remover o disparo direto de task em `api/index/router.py`; a rota deve
      chamar um service montado por `composition`, e o mecanismo de fila deve
      permanecer fora da camada HTTP.
- [x] Criar um contrato para tasks como entrypoints finos: podem usar o runtime
      do worker, domain, services e `composition`, mas não repositories,
      SQLAlchemy, UoW, Redis ou providers diretamente.
- [x] Adequar `tasks/set_indexes_history_cache.py`, que atualmente cria
      repository e Redis diretamente, movendo essa montagem para `composition`
      e delegando o fluxo a um service claro.
- [x] Confirmar que domain não importa outras camadas, service não importa API,
      tasks, entrypoints ou `composition`, e `market_data` não importa
      repositories/infraestrutura interna de outros módulos.
- [x] Não adicionar `ignore`, `noqa`, contratos mais permissivos ou imports
      indiretos como forma de ocultar violações.
- [x] Preservar contratos HTTP, status, autorização, cache e efeitos colaterais
      das rotas/tasks durante a correção, cobrindo os fluxos alterados com
      testes funcionais.
- [x] Considerar a tarefa concluída quando todos os contratos isolados de
      `market_data` passarem; violações globais restantes devem estar
      identificadas como pertencentes a outros módulos.

Resultado da implementação em 08/08/2026: os cinco contratos isolados de
`market_data` passam. Nos contratos globais permanecem duas fronteiras
quebradas, ambas fora deste módulo: services de `portfolio`/`ai` importando
entrypoints ou schemas de API, e APIs de `portfolio`/`ai` importando
persistência diretamente.

## 5. Migrar todas as entidades persistidas para modelos de domínio

### Objetivo

Aplicar a todas as tabelas do app o padrão iniciado com `Quote`: uma única
classe `dataclass` no `domain` do módulo proprietário, sem dependência de
SQLAlchemy, uma definição `Table` em `infra/db/tables` e o mapeamento imperativo
em `infra/db/mappings`. Ao final, não deve existir uma segunda classe ORM para
representar a mesma entidade de domínio.

### Escopo

- [x] Inventariar e atribuir um módulo proprietário a todas as entidades. O
      baseline atual possui 32 classes declarativas, distribuídas entre assets
      e seus subtipos/cadastros auxiliares, portfolio, AI e users, além das 6
      tabelas que já usam mapeamento imperativo.
- [x] Incluir todas as tabelas, inclusive tabelas de lookup, configuração,
      associação e a tabela de usuário; nenhuma deve permanecer declarativa
      por ter sido esquecida no inventário.
- [x] Definir a ordem de migração por módulo/agregado e executar a mudança
      incrementalmente, mantendo o app funcional entre etapas e respeitando a
      ordem das foreign keys.
- [x] Criar ou completar os modelos em `app/modules/<module>/domain`, usando
      `dataclass` sem imports de SQLAlchemy, FastAPI, Pydantic, repositories,
      API, `composition` ou infraestrutura.
- [x] Preservar no domínio somente estado e comportamento da entidade; mover
      enums e constantes que representam conceitos de negócio para o módulo
      de domínio correto e manter IDs de seed/detalhes de banco na
      infraestrutura.
- [x] Criar as definições `Table` em `app/infra/db/tables`, preservando
      exatamente schema, nome de tabela e coluna, tipos, precisão, nullability,
      defaults, server defaults, indexes, unique constraints, checks e foreign
      keys existentes.
- [x] Criar os mapeamentos em `app/infra/db/mappings`, reutilizando
      `Base.metadata` e `Base.registry`, e registrar todos de forma idempotente
      em `start_mappers()`.
- [x] Preservar relacionamentos, cardinalidade, cascades, ordenação e
      estratégia de carregamento apenas onde forem necessários; referências
      cross-module devem preferir IDs opacos no domínio, mantendo as foreign
      keys físicas nas `Table` definitions.
- [x] Verificar separadamente a integração do `User` com FastAPI Users e adaptar
      o database adapter para trabalhar com a classe de domínio mapeada, sem
      manter uma entidade ORM duplicada.
- [x] Atualizar repositories e UoW para consultar e persistir as classes de
      domínio mapeadas, sem mudar o limite transacional nem introduzir commits
      nos repositories.
- [x] Remover de services, tasks, APIs e schemas qualquer dependência das
      classes em `infra/db/models`; respostas HTTP continuam sendo mapeadas por
      schemas próprios da API.
- [x] Atualizar seeds, factories, fixtures, serializers, caches e integrações
      que hoje instanciam ou inspecionam diretamente as classes declarativas.
- [x] Garantir que Alembic carregue todas as `Table` definitions e mappers sem
      depender de importar as antigas classes declarativas.
- [x] Para cada agregado migrado, cobrir construção sem banco, persistência,
      leitura, update, delete, relacionamentos e comportamento do UoW.
- [x] Rodar os testes arquiteturais para provar que domain permanece
      independente e que entidades de infraestrutura não vazam entre módulos.
- [x] Rodar `alembic check`/schema diff após cada etapa. A refatoração de
      mapeamento deve produzir diff vazio e não deve criar migration nem alterar
      dados; qualquer mudança física necessária deve virar uma tarefa separada.
- [x] Remover `app/infra/db/models` e imports residuais somente depois que todas
      as entidades, inclusive `User`, estiverem mapeadas e os testes passarem.
- [x] Atualizar `docs/architecture/overview.md`, substituindo a descrição do
      "imperative mapping pilot" pelo padrão oficial de persistência do app.

## 6. Criar documentação visual da arquitetura

### Objetivo

Criar uma página frontend isolada em `/architecture` que apresente uma visão
high-level, conceitual e navegável da arquitetura do app. O diagrama deve ser
mantido como dados TypeScript hardcoded, atualizáveis conforme o sistema evolui,
sem introspecção em runtime e sem tentar reproduzir todo o código.

### Escopo

- [x] Antes de implementar o grafo, inventariar no código os schedulers,
      tasks/jobs, módulos, services, repositories, bancos, tabelas relevantes,
      caches, integrações externas, filas/eventos e suas principais operações
      de leitura e escrita.
- [x] Registrar o recorte escolhido para a primeira versão, priorizando poucos
      fluxos operacionais importantes, como ingestão de market data,
      consolidação de portfolio, caches e integrações relacionadas, sem tentar
      representar todas as classes e tabelas.
- [x] Adicionar `@xyflow/react` e Dagre como dependências do frontend, pois elas
      ainda não estão declaradas no projeto, sem introduzir bibliotecas de
      edição de diagramas.
- [x] Criar a rota React `/architecture`, integrada somente ao roteamento e ao
      layout visual necessários, sem backend, endpoint, tabela ou alteração nos
      fluxos de produção.
- [x] Isolar a feature em um módulo próprio, separando no mínimo a página, o
      mapa estático, o algoritmo de layout e os custom nodes.
- [x] Definir tipos TypeScript para nodes, categorias, metadados e edges, com
      uma estrutura hardcoded equivalente a `nodes = [...]` e `edges = [...]`.
- [x] Manter os dados arquiteturais fora do renderer para que uma atualização
      futura normalmente exija apenas alterar o mapa do grafo.
- [x] Criar nodes simples, compactos e visualmente distintos para `Scheduler`,
      `Task/Job`, `Module`, `Service`, `Database`, `Cache` e `External API`.
- [x] Exibir somente informações operacionais úteis em cada node, como nome,
      categoria, periodicidade de uma task e principais tabelas de um banco,
      evitando detalhes de implementação.
- [x] Modelar relações tipadas como `triggers`, `calls`, `reads`, `writes`,
      `reads/writes`, `caches`, `publishes` e `consumes`, usando labels somente
      quando melhorarem a leitura.
- [x] Usar Dagre para calcular automaticamente as posições, preferencialmente
      da esquerda para a direita ou de cima para baixo conforme o resultado mais
      legível; não armazenar coordenadas manuais no mapa.
- [x] Disponibilizar zoom, pan, `fitView` e controles do React Flow; adicionar
      minimap somente se ela ajudar a navegar o tamanho real da primeira versão.
- [x] Avaliar groups/subflows para os módulos principais e adotá-los somente se
      reduzirem cruzamentos e tornarem os limites mais claros.
- [x] Aplicar estilos compatíveis com todos os temas existentes, com contraste
      acessível, poucas cores e distinção que não dependa somente de cor.
- [x] Tratar loading inicial, redimensionamento da viewport e telas menores sem
      recalcular o layout continuamente ou causar loops de renderização.
- [x] Garantir que o diagrama seja somente leitura: sem criação, remoção,
      conexão ou persistência manual de nodes.
- [x] Adicionar testes para o mapa, layout e renderização principal da página,
      incluindo a presença das categorias e fluxos definidos no recorte.
- [x] Rodar lint, typecheck, testes e build do frontend e documentar onde o mapa
      estático deve ser atualizado em mudanças arquiteturais futuras.

## 7. Consolidar portfolios usando cotações persistidas

### Objetivo

Fazer a consolidação e o recálculo de portfolios consumirem exclusivamente o
histórico de `Quote` persistido no banco. A busca externa e a ingestão de
cotações permanecem fluxos independentes e devem acontecer antes da
consolidação quando dados novos forem necessários.

### Escopo

- [x] Mapear todos os caminhos de consolidação/recalculo que consultam o
      provider direta ou indiretamente.
- [x] Expor em `market_data` um service público de leitura de cotações
      persistidas adequado ao consumo pelo módulo `portfolio`.
- [x] Fazer `portfolio` acessar esse service público, sem importar repository,
      model ou infraestrutura interna de `market_data`.
- [x] Remover chamadas externas da transação e do fluxo de consolidação; a
      ausência de cotação deve produzir um erro de aplicação claro e não um
      fallback silencioso ao provider.
- [x] Preservar as regras atuais de datas, close price, moeda, eventos,
      dividendos e cálculo de posição.
- [x] Ordenar os jobs agendados para que a ingestão de quotes seja concluída
      antes da consolidação de portfolios, sem acoplar as duas operações no
      mesmo service.
- [x] Cobrir com testes que a consolidação lê o banco, não chama provider e
      trata explicitamente histórico ausente.
- [x] Rodar testes funcionais e arquiteturais, preservando os resultados de
      posição e os contratos HTTP/tasks existentes.
