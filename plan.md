# Plano de testes

Desenhado a partir do que o projeto é, não do que já existe em `tests/`.
Estado inicial medido em 2026-08-14: **206 testes, 149 passando, 57 com erro, 57% de cobertura**.

## Andamento

**Hoje: 209 passando, 2 xfail, 0 falhando. Cobertura 60%** (era 149 passando,
57 com erro, 57%). Sem os containers no ar, o e2e pula: 150 passando, 61
pulados.

- [x] **Fase 0 — instrumentação**
- [x] **Fase 1 — contrato**: snapshot de OpenAPI versionado, verificado nos dois sentidos
- [x] **Fase 2 — e2e vivo**: harness em `tests/e2e/`, factories, e os 57 testes
      órfãos migrados para ele
- [ ] Fase 3 — o dinheiro
- [ ] Fase 4 — as garantias documentadas
- [ ] Fase 5 — repositório, serviço e trava

### Bugs encontrados pelo harness

Nenhum foi procurado; todos apareceram porque um teste que não rodava voltou a
rodar.

1. **Corrigido.** `Portfolio` mapeia `user` como relationship sobre a mesma
   coluna da FK `user_id`, e a dataclass inicializa `user=None`; no flush o
   relationship vencia e gravava NULL. 39 relationships do domínio têm essa
   forma. `POST /portfolio` e `POST /market_data/broker` nunca funcionaram.
2. **Corrigido.** Update parcial (`{'id': 4, 'name': 'x'}`) construía a entidade
   pelo `__init__`, que exige campos sem default, e estourava `TypeError` antes
   de chegar ao banco. `PUT /portfolio/{id}` e `PUT /portfolio/dividend/{id}`.
3. **Corrigido.** `PUT /market_data/broker/{id}` gravava o novo `currency_id` e
   respondia com a currency antiga: o relationship já carregado não era
   invalidado.
4. **Aberto** — `GET /portfolio/income_tax/{id}/assets_and_rights` levanta
   `KeyError: 'asset_id'` em carteira sem posição. Carteira nova pedindo IR = 500.
5. **Aberto** — `PUT /portfolio/dividend/{id}` responde com entidade destacada e
   levanta `DetachedInstanceError` ao serializar. A escrita está certa.

Os dois abertos estão como `xfail(strict=True)`, então falham sozinhos quando
alguém corrigir e esquecer de tirar a marca.

## O que este projeto arrisca

Um app de carteira erra de quatro formas, e cada uma pede um tipo de teste
diferente. A suíte deve ser desenhada a partir daqui, não a partir da pirâmide
genérica.

| Risco | Como se manifesta | O que pega |
|---|---|---|
| **Número errado** | CAGR, DARF, retorno ou conversão silenciosamente errados | unit de domínio, propriedade, golden file |
| **Contrato quebrado** | o front para de funcionar sem ninguém mudar o front | snapshot de OpenAPI, e2e |
| **Erosão de arquitetura** | camada volta a se misturar | teste de arquitetura, import-linter |
| **Provider muda ou cai** | brapi devolve outro formato, ou 429 | adapter contra resposta gravada, caminho de falha |
| **Cache velho** | número certo calculado, número velho servido | teste de hit/miss/invalidacão |

O primeiro é o que dói: é dinheiro, e falha em silêncio. É onde a suíte deve ser
mais densa.

## A oportunidade que ninguém está usando

`docs/architecture/overview.md` já enuncia garantias de comportamento em prosa.
Elas são especificação executável e **nada as verifica hoje**:

- consolidação lê apenas cotação persistida; histórico faltando é falha explícita
  e nunca dispara chamada a provider dentro da transação de escrita;
- ingestão de USD/BRL derruba o cache depois do commit, e nada o repovoa: a
  próxima leitura erra e preenche;
- cotação que não pode ser reexpressa fielmente — anterior ao histórico de
  câmbio, ou de moeda desconhecida — fica de fora, não é chutada;
- valor pago por cota vem do que o provider diz que foi pago, nunca derivado do
  yield, e o rótulo do pagamento é carregado para que amortização não seja lida
  como rendimento;
- no perfil de FII, uma metade falhando deixa a outra na página; as duas falhando
  levanta;
- o separador final na chave de cache impede que a carteira 1 case com a 10.

Cada bullet desses é um teste. Escrever a suíte a partir da documentação, em vez
de a partir do código, é o que impede o teste de só repetir o que o código faz.

## Estrutura

```
tests/
  conftest.py              ambiente e asyncio, nada mais
  factories.py             construtores de linha, em SQL
  fakes.py                 dublês: uow, cache
  unit/
    domain/                cálculo puro por módulo
    lib/                   finance, income_tax
    services/              orquestração com fakes
  integration/
    db/                    repositório, mapeamento, UoW — Postgres real
    providers/             adapters contra resposta gravada
  e2e/
    conftest.py            engine, app, client, seed
  contract/
    openapi.json           snapshot versionado
  architecture/
```

Três coisas que essa estrutura resolve e a atual não:

**`factories/` em vez de seed inline.** Hoje cada teste monta seu portfólio na
mão. Um construtor (`a_portfolio().with_transaction(...).build()`) faz o teste
declarar só o que importa para ele, e o resto ganha default coerente.

**`fakes/` como pacote, não um arquivo.** `FakeUnitOfWork` e `FakeCache` já
existem e são bons. Faltam um provider fake e um relógio fake — sem relógio
injetável, todo teste de CAGR e de janela de 12 meses depende da data de hoje.

**`contract/`.** O front consome esta API. Um snapshot do `openapi.json`
versionado, com um teste que compara, transforma mudança acidental de contrato em
diff no PR. Isso não é hipótese: durante o refactor de hoje essa técnica pegou
uma mudança real de nullability que nem os testes nem o linter viram.

## Decisões técnicas

### Banco: Postgres efêmero, não SQLite

Testei o schema real contra SQLite e ele não sobe. Quatro bloqueios:

1. quatro schemas Postgres — `asset` (17 tabelas), `portfolio` (12),
   `market_data` (7), `ai` (2), mais `public`; SQLite não tem schemas;
2. `JSONB`, `UUID(as_uuid=True)` e `server_default=func.gen_random_uuid()` em `ai.py`;
3. índice parcial com `postgresql_where` em `ai_artifact`;
4. FK qualificada `asset_visit.user_id → public.user.id`, que é onde o
   `create_all` estoura com `NoReferencedTableError`.

Fazer SQLite funcionar exigiria `.with_variant()` e `schema_translate_map` — ou
seja, alterar definição de tabela de produção para servir o teste, e depois
testar contra um schema que não é o que vai para produção. O
`backend/docker-compose.yml` já tem `db_test` na 5434 e o `.env.test` já aponta
para lá.

### Isolamento: transação externa com savepoint

Cada teste abre conexão, começa transação, prende a sessão com
`join_transaction_mode="create_savepoint"` e dá rollback no fim. O `commit()` do
código sob teste vira SAVEPOINT e não escapa. Nada é truncado, nenhuma lista de
tabelas preservadas precisa ser mantida, e o seed de referência carrega uma vez
por sessão. É a receita da própria doc do SQLAlchemy, e a 2.0.39 que usamos
suporta.

### Costura: `AsyncSessionLocal.configure`, e só

A ideia original era sobrescrever a dependência `get_uow`. **Não funciona**:
`app/composition/` constrói `UnitOfWork()` cru em nove lugares, e esses nunca
passam pela dependência — apontariam para o banco de desenvolvimento no meio do
teste.

A costura que funciona é uma abaixo, no `sessionmaker` que toda `UnitOfWork()`
usa por default:

```python
AsyncSessionLocal.configure(bind=conn, join_transaction_mode='create_savepoint')
```

Uma linha, e todo caminho de persistência do app entra na transação do teste.
Celery é neutralizado no nível do framework (`Task.delay` e `send_task`), não
por rota. Nenhum `patch` por caminho de módulo — foi exatamente o que quebrou a
suíte anterior quando o refactor moveu os arquivos.

### Relógio injetável

Retorno de 12 meses, CAGR e janela de ingestão dependem de "hoje". Enquanto isso
vier de `date.today()` dentro do código, o teste ou congela o relógio por
monkeypatch global ou fica frágil no fim do ano. Um `clock` injetado resolve, e
é pré-requisito da fase 2.

## Fases

Cada fase termina verde e é commitável sozinha.

### Fase 0 — instrumentação

- `asyncio_mode = "auto"`; hoje todo teste carrega `@pytest.mark.asyncio`
- markers `unit`, `integration`, `e2e`, `contract` registrados
- `[tool.coverage.run]` com `branch = true` e `omit` de alembic
- tasks por camada: `test-unit`, `test-integration`, `test-e2e`

### Fase 1 — contrato

A mais barata e a que protege o front imediatamente.

- gerar `tests/contract/openapi.json` do app
- teste que compara o spec atual com o snapshot e falha com diff legível
- task `openapi-update` para aceitar a mudança de propósito

### Fase 2 — e2e vivo

Onde os 57 voltam.

- conftest de e2e do zero: engine, transação externa, `client`, `db`, seed
- `factories/` para portfólio, ativo, transação, cotação
- override de autenticação e de composição
- migrations do alembic rodando uma vez por sessão, para que elas também sejam exercitadas

### Fase 3 — o dinheiro

Sem banco, maior retorno por linha escrita.

- `lib/finance` e `lib/income_tax`: retorno, CAGR, volatilidade, DARF, isenção
- domínio de portfolio e de market_data
- bordas que hoje ninguém cobre: série vazia, um ponto só, data fora do
  histórico, divisão por zero, NaN vindo de DataFrame
- propriedade com hypothesis nos invariantes: retorno acumulado é a composição
  dos diários; BRL→USD→BRL na mesma data é identidade; CAGR de série constante é zero
- golden file da consolidação: carteira fixa entra, números conhecidos saem

### Fase 4 — as garantias documentadas

Um teste por bullet da seção "oportunidade" acima.

### Fase 5 — repositório, serviço e trava

- queries do `PortfolioRepository`, a classe com mais métodos do projeto
- serviços grandes com `FakeUnitOfWork`: `quote_service` tem 809 linhas
- `--cov-fail-under` no piso medido, entrando no `task check` e no hook

## Fora de escopo

- **Celery real**: as tasks são entrypoints finos; testar o agendador é testar o
  Celery. Elas entram como unit, chamando serviço fake.
- **Rede em teste**: provider só contra resposta gravada.
- **Frontend**: outro plano.
