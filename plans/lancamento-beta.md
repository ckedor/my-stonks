# Primeira versão com usuários de teste

Status: plano, montado em 09/10/2026 a partir de uma leitura do código. Nada
foi implementado ainda.
Janela: três semanas, de 12/10 a 30/10/2026. Os primeiros convites saem em
29/10.

Decisões confirmadas na discussão:

- **A autenticação vai para um provedor externo.** O mesmo provedor será o
  servidor de autorização do servidor MCP da carteira, que vem depois. Por
  isso ele tem de suportar OAuth 2.1 com registro dinâmico de cliente (DCR)
  e, de preferência, CIMD.
- **As carteiras recomendadas e o consenso são só do mantenedor.** Eles saem
  do alcance de qualquer outro usuário, tanto na API quanto na tela.
- **Esta versão não cobra.** Os usuários de teste entram num plano cortesia.
  CNPJ, contador e conta no gateway andam em paralelo (trilha **P**), e a
  integração de pagamento fica para a versão seguinte.

## 1. Resultado esperado

Uns dez amigos convidados usam o app em produção sem que nenhum consiga ver
ou alterar os dados de outro. Cada um entra por cadastro com convite, com
e-mail verificado, e recupera a senha sozinho. Os erros chegam ao mantenedor
antes do usuário reclamar. O gasto de IA tem teto por pessoa. O que não está
pronto, ou cuja licença não está resolvida, fica escondido atrás de feature
flag. Existe uma página pública que mostra o produto, e os textos legais
mínimos estão no ar.

Fora do escopo: cobrança, MCP, chat, notícias, agente de anomalias com IA,
custo do Render automatizado e a troca de nome em domínio próprio, caso o nome
não esteja decidido até 23/10 (ver 7).

## 2. Diagnóstico de partida

| Evidência | Consequência |
| --- | --- |
| `backend/app/modules/portfolio/api/router.py:73` e `:87`, e as sub-rotas com `portfolio_id` | Nenhuma checa a posse da carteira. Só `income_tax` e `lab` filtram por usuário. Qualquer usuário logado lê, altera ou apaga a carteira de outro, inclusive o PDF da nota (`document/router.py:22`). |
| `backend/app/modules/users/views.py:89` | `GET /users` não tem autenticação e devolve o e-mail de todos. |
| `market_data/api/asset/router.py` (`POST ''`, `PUT/DELETE /{asset_id}`) e `broker/router.py` | O cadastro compartilhado aceita escrita de qualquer usuário. A tela só usa essas rotas no admin (`pages/admin/assets`, `pages/admin/brokers`). |
| `users/views.py:38` | Com `ENVIRONMENT=development`, toda requisição vira superusuário. |
| `views.py:18` e `:77`, `pages/login/index.tsx:62` | Não há cadastro aberto, reset de senha nem verificação de e-mail. O JWT vale 30 dias, sem revogação, e fica num cookie legível por JS. |
| `frontend/src/actions/auth.ts`, `queries/client.tsx:40` | O logout não limpa o cache persistido no `localStorage` nem as stores com `persist`. |
| `research/api/router.py` (GETs com `current_active_user`), `pages/market/fii/RecommendedFIIs.tsx` | Carteiras recomendadas e consenso aparecem para qualquer usuário. |
| `config/settings.py` (`AI_DAILY_COST_LIMIT_USD`), `ai/domain/entities.py:87` | O teto de IA é global e `ai_run` não guarda o usuário. Uma pessoa esgota o dia de todas, e o custo não é atribuível. |
| Rotas de extração de PDF | Não há limite de tamanho nem de páginas. A chamada ao modelo é síncrona dentro do request. Não há rate limit em lugar nenhum. |
| `backend/render.yaml:10`, `start_web.sh`, `start_worker.sh` | API em `plan: free` (hiberna) com um único processo uvicorn. Worker `--pool=solo -B`: uma tarefa por vez, com o beat embutido. |
| `.pre-commit-config.yaml:94` e `:112` | `pytest` e `lint-imports` rodam com `\|\| true` porque a suíte falha. Nada barra o push. |
| `config/logger.py` | Logs só no stdout. `logtail-python` está instalado e não é usado. Não há Sentry nem uptime. |
| `pages/market/overview/mockData.ts`, abas "Briefing · mock" e "Radar · mock" | Telas com dado fictício visíveis a todos. |
| `infra/ai/tracing.py:58` | O Langfuse grava o prompt e a saída. As notas extraídas saem para o Langfuse Cloud, o que entra na política de privacidade. |
| `alpha_vantage_client.py`, `anbima_client.py`, `foxbit_client.py`, `mais_retorno_client.py` | Clientes sem uso. Mesmo assim, `ALPHAVANTAGE_KEY` é obrigatória no settings. Remover depende do mantenedor. |

## 3. Semana 1 (12 a 16/10): ninguém vê o que não é seu

O que vem primeiro não depende do provedor de auth. A posse da carteira é
checada contra `user.id`, venha o usuário de onde vier.

### Seg 12/10: isolamento entre usuários

1. **Dependência de posse.** Criar `owned_portfolio(portfolio_id, user)` em
   `app/modules/portfolio/api/`. Ela lê a carteira e responde 404 quando
   `portfolio.user_id != user.id`, para não confirmar que o id existe.
   Aplicar a todas as rotas que recebem `portfolio_id` por path, query, form
   ou body.
   - As rotas que recebem só o id do filho (`PUT/DELETE /transaction/{id}`,
     `/dividend/{id}`) resolvem a carteira do filho e checam a posse.
   - Mover uma transação para outra carteira checa as duas.
2. **Teste que prova o guard.** Em `tests/e2e/`, um teste percorre
   `app.routes`, encontra toda rota sob `/portfolio` que tem `portfolio_id`
   ou id de filho, e chama cada uma com o usuário B sobre a carteira do
   usuário A. Todas têm de responder 404 ou 403. Uma rota nova sem a checagem
   quebra o teste.
   - Junto, um caso que prova que o teste dispara: uma rota de exemplo sem
     guard, montada só no teste, deve ser apontada.
3. **`GET /users`** passa a exigir superusuário.
4. **Cadastro compartilhado.** `POST ''`, `PUT/DELETE /{asset_id}` de ativo e
   o CRUD de corretora passam a exigir superusuário. Ficam abertos a usuário
   comum o `POST /fixed_income` e o `POST /fund`, que o fluxo de compra usa
   (`FixedIncomeForm.tsx:130`, `api/fundRegistry.ts:130`).
5. **Carteiras recomendadas só do mantenedor.**
   - Todo o router de `research` vai para superusuário.
   - `RecommendedFIIs` some da página de FII para quem não é admin.
   - A regra entra em `docs/architecture/overview.md`, na seção
     *Recommendation ingestion*.

Pronto quando: o teste de varredura passa, e o snapshot do OpenAPI só mudou
onde o contrato mudou de verdade (`task openapi_update` e revisar o diff).

### Ter 13/10: escolha do provedor de auth (spike de um dia)

Os candidatos com DCR documentado para MCP são **WorkOS AuthKit** (DCR e
CIMD) e **Clerk** (DCR). Criar uma conta de teste em cada e conferir:

| Critério | Por quê |
| --- | --- |
| DCR e CIMD como servidor de autorização MCP | É o requisito da decisão. |
| Tela de login e e-mails em pt-BR | O usuário é brasileiro. |
| Login com Google, MFA e reset de senha | É o que falta hoje. |
| Restrição de cadastro (allowlist ou convite) | O beta é fechado. |
| JWT com `email` e `sub` no access token, validável por JWKS | O backend continua dono do usuário local. |
| Preço até ~10 mil usuários ativos e região dos dados | Custo e LGPD (transferência internacional). |

Saída do dia: o provedor escolhido e um parágrafo em
`docs/architecture/overview.md` dizendo por quê.

### Qua 14 e Qui 15/10: integrar o provedor

Backend:

1. Validar o access token pelo JWKS do provedor, com `iss` e `aud` fixos. O
   `aud` da API é diferente do que o MCP vai usar depois, para um token de
   MCP não abrir a API inteira.
2. O usuário local continua a fonte de verdade de quem é admin, beta ou
   membro.
   - Migração: coluna `users.external_id` (única).
   - No primeiro login, um usuário existente é ligado pelo e-mail
     verificado. Um usuário novo só é criado se houver convite (ver semana
     2). Sem convite, a resposta é 403 com uma mensagem de lista de espera.
3. Sai o fastapi-users: JWT próprio, `/auth/jwt/login`, `/auth/register`,
   `UserManager`, `SessionMiddleware` e `hashed_password`. Uma migration
   remove a coluna depois da migração dos usuários. Atualizar o snapshot do
   OpenAPI.
4. **Bypass de desenvolvimento.** Ele só funciona com
   `ENVIRONMENT=development` **e** `AUTH_DEV_BYPASS=true`. A aplicação recusa
   subir com o bypass ligado fora de desenvolvimento, e um teste prova isso.
5. CORS: o regex de `localhost` só vale em desenvolvimento
   (`fastapi_app.py:113`).

Frontend:

1. SDK do provedor no login e no cadastro. A tela atual de
   `pages/login/` vira a casca com o vídeo, ou é substituída.
2. O token sai do `js-cookie`: o interceptor de `lib/api.ts` pede o token ao
   SDK.
3. Um 401 leva ao login.
4. O logout limpa o `queryClient`, remove `my-stonks-query-cache` e reseta as
   stores com `persist` (carteira, moeda, favoritos, mercado). A cidade fica,
   porque é por carteira e o id não vaza dado. Um teste em vitest prova que o
   logout limpa.
5. `frontend/CLAUDE.md` e `backend/CLAUDE.md` passam a citar a regra da
   dependência de posse e o novo fluxo de auth.

Pronto quando:
- você entra pelo provedor e vê suas carteiras;
- uma conta nova sem convite recebe 403;
- uma conta com convite entra com a carteira vazia;
- o teste de varredura continua passando.

### Sex 16/10: infra e observabilidade

1. **Render.**
   - API em plano pago, uvicorn com `--workers 2`.
   - Beat como serviço próprio (`celery beat`). O worker sem `-B`, com
     concorrência maior que 1 e duas filas: `user` (recálculo pedido por
     usuário) e `ingestion` (rotinas agendadas). Assim a nota de alguém não
     espera a ingestão das 06:15.
   - Atualizar `render.yaml` e o trecho de operations no `overview.md`.
2. **Banco.** Confirmar no painel o plano do Postgres e o backup com
   point-in-time. Fazer um restore de teste num banco descartável e anotar o
   passo a passo no `backend/README.md`. O `backend/CLAUDE.md` cita um
   `restore_db.py` que não existe: criar o script ou corrigir o documento.
3. **Staging.** Um ambiente igual ao de produção, com banco próprio, onde a
   migração de auth roda antes.
4. **Sentry** no FastAPI, no Celery e no React, com `user.id` (sem e-mail) e
   release no deploy. Para não mandar dado financeiro, `send_default_pii`
   fica desligado e o corpo das requisições fica fora.
5. **Better Stack.**
   - Logs, pelo `logtail-python` já instalado, ou pelo log drain do Render.
   - Uptime em `/hc` e no frontend.
   - Página de status pública.
6. **Alerta de rotina falhando.** Uma `task_run` com status de falha gera um
   alerta, a partir do módulo de operations, que já registra os runs.
7. **Suíte verde.** Rodar `./check.sh --back` na máquina do mantenedor,
   corrigir o que falha e tirar os dois `|| true` do
   `.pre-commit-config.yaml`.

## 4. Semana 2 (19 a 23/10): convite, limites e controle

### Seg 19/10: glossário e modelo

1. **`docs/domain.md` ganha os termos novos:**
   - *Role* (papel): admin, beta ou member.
   - *Plan* (plano): cortesia agora; mensal depois.
   - *Feature flag*.
   - *Invite* (convite).
   - *Usage quota* (cota de uso).
2. **Tabelas:**
   - `users.role`.
   - `users.plan` e `users.plan_expires_at` (nulo para cortesia sem prazo).
   - `users.terms_version_accepted` e `users.terms_accepted_at`.
   - `invite` (e-mail, criado por, usado em).
   - `feature_flag` (chave, papéis, ids de usuários, ligado).
3. `/users/me` devolve papel, plano e flags ligadas para o usuário.

### Ter 20/10: feature flags

1. Backend: dependência `require_flag('chave')`, que responde 404 quando a
   flag está desligada para o usuário.
2. Frontend: `useFlag('chave')`, e a navegação (`layouts/navigation.ts`)
   esconde a entrada.
3. **Flags iniciais:**
   - `market_mock_tabs`: Briefing e Radar, só admin.
   - `msci_series`, `ifix_series`, `ucits_holdings`: as fontes da seção 8,
     beta e admin.
   - `city_game`: decidir se entra no beta.
   - `laboratory`.
4. Tela no admin para ligar e desligar flags por papel ou usuário.

### Qua 21/10: limites e custo por usuário

1. **Rate limit** com slowapi sobre o Redis, por usuário autenticado e, sem
   usuário, por IP.
   - Limite padrão por minuto.
   - Limites específicos para a extração de nota e de extrato (por hora),
     `/market_data/quotes/on-demand` (gasta quota da Brapi), `/lab/backtest*`
     e `patrimony_evolution`.
2. **Upload.** Recusar PDF acima de N MB e de N páginas antes de guardar e
   antes de chamar o modelo.
3. **IA por usuário.**
   - Coluna `ai_run.user_id`, preenchida na camada de gravação
     (`infra/ai/recording_provider.py`). O usuário chega pelo request; a
     camada continua sendo a única fronteira.
   - Cota diária por usuário, checada no mesmo lugar do teto global, que
     continua como última proteção.
   - A tela de uso de IA no admin ganha o recorte por usuário.
4. A extração de PDF fica síncrona nesta versão, porque o volume do beta é
   pequeno. Mover para tarefa é o primeiro item da próxima versão se o p95
   passar de 30 s (o Sentry mede).

### Qui 22/10: admin v1

Em `pages/admin/`, uma tela "Visão geral":

- usuários totais, novos por semana e ativos em 7 e 30 dias, que exigem
  gravar `users.last_seen_at` (no máximo uma escrita por hora por usuário);
- convites enviados e usados;
- gasto de IA no mês, total e por usuário;
- custo fixo do mês (Render, Brapi, provedor de auth, Sentry, Better Stack)
  informado à mão numa tabela `operating_cost`;
- uso do bucket, que já existe em operations.

Mais a tela de convites: criar, reenviar, revogar.

### Sex 23/10: legal mínimo e direitos do titular

1. **Rascunho dos três textos**, para revisão de um advogado na trilha P:
   - **Termos de uso:** não é recomendação de investimento; dados de
     terceiros podem ter erro ou atraso; a apuração de IR é um auxílio e deve
     ser conferida.
   - **Política de privacidade:** controlador; dados coletados; finalidade;
     operadores (hospedagem, bucket, provedor de auth, OpenAI, Anthropic,
     Langfuse, Sentry, Better Stack, e-mail); transferência internacional;
     retenção; canal do encarregado.
   - **Cookies:** só os essenciais nesta versão, sem analytics. Por isso não
     há banner de consentimento, só um aviso.
2. **Aceite versionado.** Um usuário sem a versão vigente aceita antes de
   entrar.
3. **Disclaimers nas telas**, num componente só:
   - página de ativo e descrição por IA;
   - rankings de `/market/assets`;
   - Laboratório ("rentabilidade passada…");
   - IR, que já manda conferir no Sicalc.
4. **Excluir conta.** Apaga carteiras (o caminho de `delete_portfolio` já
   apaga documentos e séries), pagamentos de DARF, carteiras teóricas,
   favoritos, visitas, linhas de `ai_run` (anonimizar o `user_id`) e o
   usuário no provedor de auth. Um teste prova que não sobra linha com o
   `user_id`.
5. **Exportar dados.** Um JSON com carteiras, transações, proventos e
   documentos (links). Pode ser assíncrono e chegar por e-mail.

## 5. Semana 3 (26 a 30/10): marca, vitrine e entrada dos amigos

### Seg 26/10: marca e temas

1. **Nome.** Se estiver decidido, trocar "My Stonks" nos ~28 arquivos onde
   aparece. A chave `my-stonks-query-cache` muda junto, e o cache quente se
   perde uma vez, o que é aceitável. Domínio apontado para frontend e API, e
   a lista de CORS atualizada.
2. **Seis temas** (3 claros, 3 escuros) a partir dos 24 de
   `theme/presets.ts`. A identidade pode sair das esculturas (touro, tartaruga,
   fênix, polvo) como mascotes e ícones.
3. Atualizar `themes.test.ts` e regenerar os snapshots da regressão visual na
   máquina do mantenedor, nunca fora dela.

### Ter 27/10: página pública

1. **Site estático separado do app** (Astro), por SEO e velocidade.
2. **Seções:**
   - tudo num lugar só;
   - importação por nota e extrato;
   - visualizações simples e avançadas;
   - análises e laboratório;
   - mercado;
   - IR;
   - histórico e documentos;
   - "em breve": MCP e chat;
   - FAQ;
   - links legais.
   Prometer só o que existe. As corretoras citadas são as que o leitor de
   nota cobre hoje: Sinacor, Avenue/Apex e extrato BTG. Notícias não entram.
3. **Vídeos de cada seção** gravados com o pipeline de reel
   (`playwright.reel.config.ts`) contra a carteira de exemplo do dia 28.
4. Formulário de lista de espera, que vira convite no admin.

### Qua 28/10: primeiro uso

1. **Carteira de exemplo**, só leitura, que todo usuário novo vê ao lado da
   própria. Ela também alimenta os vídeos e o monitoramento sintético.
2. **Estado vazio guiado**, com três caminhos: importar nota, lançar
   transação, ver a carteira de exemplo.
3. **E-mails transacionais** do provedor de auth, em pt-BR. O convite é
   enviado pelo app (Resend ou Postmark), com SPF, DKIM e DMARC no domínio.

### Qui 29/10: suporte, bugs e monitoramento sintético

1. **Botão "Reportar problema"** com o widget de feedback do Sentry: rota,
   usuário, erros recentes e screenshot opcional.
2. **E-mail de suporte** com helpdesk (Crisp, Chatwoot ou Help Scout),
   resposta automática e a promessa escrita como "em até 24h úteis".
3. **Conta sintética em produção** com a carteira de exemplo. Um job a cada
   hora (Better Stack ou cron do Render) faz login e checa:
   - a visão geral responde;
   - o patrimônio é a soma das posições;
   - a última cotação tem menos de um dia útil;
   - a consolidação da carteira é de hoje.
   Qualquer falha gera alerta.
4. **Primeiros convites**, para 2 ou 3 pessoas próximas.

### Sex 30/10: abrir para o resto e ouvir

1. Corrigir o que os primeiros três encontraram.
2. Convidar o resto do grupo.
3. Criar `docs/beta.md` com o canal de feedback, o que observar (Sentry,
   uptime, uso de IA, rotinas) e quando revisar (diário na primeira semana).

## 6. Trilha P: fora do código, em paralelo

| Quando | O quê |
| --- | --- |
| Semana 1 | Decidir o nome. Pesquisar no INPI (classes 9, 36 e 42) e o domínio. Registrar o domínio. |
| Semana 1 | Reunião com o contador. Levar: CNAE (6311-9/00 ou 6203-1/00); Simples Nacional, Anexo III ou V e Fator R; ISS do município e NFS-e; transição CBS/IBS; serviço importado pago em dólar; pró-labore; conta PJ. |
| Semanas 1 e 2 | Abrir o CNPJ e a conta PJ. |
| Semana 2 | Abrir a conta no gateway brasileiro e usar o sandbox. O critério é recorrência nativa com cartão e Pix Automático, boleto, NFS-e automática e webhooks. Candidatos: Asaas, Pagar.me, Mercado Pago, Iugu, Efí. |
| Semana 2 | Mandar os três textos legais e a política de reembolso ao advogado. A política: primeiro mês grátis, cancelamento a qualquer momento ao fim do período, reembolso integral em até 7 dias após a primeira cobrança (CDC, art. 49). Perguntar também sobre o enquadramento CVM das telas de mercado e da futura conversa por IA. |
| Semanas 2 e 3 | Fontes de dados (seção 8): ler os termos atuais e escrever às que cabem licença. |

## 7. O que pode escorregar, e o que cortar primeiro

- **O provedor de auth leva mais de dois dias.** Isso consome a sexta da
  semana 1. A infra da sexta desce para segunda, 19, e o admin v1 encolhe
  para só usuários e convites.
- **O nome não sai até 23/10.** O beta abre com o nome atual. A troca vira
  uma tarefa à parte, sem pressa, porque o beta é fechado.
- **A ordem de corte:** admin v1 (fica o mínimo de convites); vídeos da
  landing (ficam screenshots); exportar dados (fica "peça por e-mail" no
  beta). **Não se corta:** a semana 1, as flags e a exclusão de conta.

## 8. Fontes de dados: o que fica atrás de flag

O risco tem duas partes:

- **Licença:** se pode exibir a terceiros.
- **Operação:** se o endpoint é um contrato ou um detalhe da página de
  alguém, que muda sem aviso.

Num beta fechado e gratuito, o risco de licença é pequeno. Antes de cobrar,
ele tem de estar resolvido.

| Fonte | Uso | Situação | Antes de cobrar |
| --- | --- | --- | --- |
| MSCI (`msci_index_client.py`) | séries MSCI no Mundo e no Laboratório | Os termos do site limitam o uso a fins informativos e não comerciais. Redistribuir exige consentimento escrito. O endpoint não é documentado. | Licenciar ou trocar por um proxy (ETF que replica o índice, preço via Brapi). |
| B3 `indexStatisticsProxy` (`b3_index_client.py`) | IFIX | É endpoint do site. Exibir dado da B3 a terceiros é distribuição, coberta pela política comercial de market data. | Ver se o plano da Brapi entrega o IFIX. Senão, licença B3 ou remover. |
| Status Invest (`status_invest_client.py`) | catálogo de FIIs | Endpoint interno de site privado. Não consegui abrir os termos daqui para confirmar a cláusula. | Trocar pelo catálogo da Brapi (`/market_data/fii/market` já existe) e pelo cadastro da CVM. |
| CoinDesk Data, ex-CryptoCompare (`crypto_compare_client.py`) | histórico de cripto | Fontes recentes dizem que o tier gratuito foi descontinuado em 2026, e uso comercial pede contrato. Já existe fallback para a Brapi. | Tirar e deixar só a Brapi, ou contratar. |
| iShares, Vanguard, DWS (`etf_manager_files.py`) | holdings de ETFs UCITS | APIs que servem as páginas de produto. O próprio código avisa que nada promete o formato. Termos não confirmados. | Perguntar aos gestores, ou manter só para admin. |
| Carteiras recomendadas | consenso | Já decidido: só o mantenedor (semana 1). | — |

As fontes públicas (BCB, CVM, Tesouro Transparente, SEC, GLEIF, ESMA,
OpenFIGI) seguem como estão, citadas na página de termos.
