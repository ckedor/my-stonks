# Plano de testes

Desenhado a partir do que o projeto é, não do que já existe em `tests/`.
Estado medido em 2026-08-14: **206 testes, 149 passando, 57 com erro, 57% de cobertura**.

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
  factories/               construtores de dado de domínio
  fakes/                   dublês: uow, cache, provider, relógio
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

### Costura: `get_uow`, e só

`UnitOfWork` aceita `session_factory` e `get_uow` é dependência do FastAPI:

```python
app.dependency_overrides[get_uow] = lambda: UnitOfWork(session_factory=TestSession)
```

Redis e Celery entram pelo mesmo lugar, sobrescrevendo os builders de
`app/composition/`. Nenhum `patch` por caminho de módulo — foi exatamente o que
quebrou a suíte anterior quando o refactor moveu os arquivos.

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
