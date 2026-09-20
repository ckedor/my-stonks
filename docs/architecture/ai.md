# IA: o que foi escolhido, e o que foi recusado

Este documento existe porque as decisões abaixo são fáceis de reabrir por
impulso — todo mês surge um framework — e caras de refazer. Ele diz o que foi
avaliado, o que foi escolhido e, principalmente, **o que faria a decisão mudar**.

A primeira versão do módulo de IA foi removida antes desta. Vale registrar por
quê, porque quase tudo aqui é resposta a um daqueles defeitos:

- o prompt não fazia parte da identidade do artefato, então um deploy que
  mudasse o prompt continuava servindo a resposta velha por sete dias;
- a saída era texto livre num JSONB de uma chave: a tabela prometia dado
  estruturado e entregava string;
- nenhum dado da própria aplicação entrava no prompt — o modelo respondia sobre
  um ticker com o que tinha na memória de treino, sem cotação e sem cadastro;
- nada registrava token, custo ou latência;
- e a rota de produto nunca foi importada por tela nenhuma.

O último é o que de fato a matou. Foi infraestrutura sem produto.

## Frameworks: por que nenhum, por enquanto

Quatro problemas costumam ser confundidos num só. Separá-los é o que torna a
decisão simples.

| Problema | Quem resolve | Situação aqui |
| --- | --- | --- |
| Saída estruturada válida | O SDK, hoje | Resolvido: `json_schema` estrito |
| Trocar de provedor, cair para outro | LiteLLM, ou uma cadeia própria | Cadeia própria sobre o Protocol que já existia |
| Laço de tools, estado, multi-step | PydanticAI, LangGraph | **Não existe** neste módulo |
| Prompt, eval, tracing | Langfuse e concorrentes | Prompt aqui; trace no Langfuse |

**Instructor** — recusado. O valor dele era fazer o modelo emitir JSON válido, e
isso hoje está no SDK: `responses.parse` do lado da OpenAI, `output_config` do
lado da Anthropic. O que sobraria seria um retry em falha de validação.

**LangChain** — recusado. O valor dele é o zoológico de integrações. Aqui há um
provedor, talvez dois, e adotá-lo significaria uma dependência grande para
reganhar `ChatOpenAI`, que já existe como `AsyncOpenAI`, brigando com o Protocol.

**LangGraph** — recusado *por ora*, e é o candidato mais legítimo dos três. Ele
resolve máquina de estados durável com humano no meio. Duas coisas o afastam
hoje: um snapshot é uma chamada e uma resposta, sem laço para orquestrar; e
**Celery mais Postgres já são um substrato durável** — adotá-lo seria manter
dois. Reabrir quando um fluxo tiver de pausar para aprovação e retomar depois,
o que a montagem de carteira no laboratório pode vir a exigir.

**PydanticAI** — recusado *por ora*, e é o candidato para o chatbot. `deps_type`
é injeção de dependência em tools, e este backend já tem composition root; a
saída tipada, os retries e o streaming vêm de graça. Não entra agora porque
snapshot não tem laço de tools, e um framework no meio de um caminho que não
precisa dele só adiciona superfície.

**LiteLLM** — recusado como gateway, com uma ressalva honesta. Passar as chamadas
por ele substituiria o mapeamento cuidadoso de erro para `IntegrationTimeout`,
`IntegrationRateLimited` e companhia, que o handler HTTP já traduz em status. O
que ele tem de melhor e aqui é feito à mão é o **mapa de preços mantido**
(`app/modules/ai/domain/pricing.py`), que envelhece a cada mudança de tabela dos
provedores. Se manter esse arquivo virar incômodo, importar o `litellm` só para
`completion_cost` é um meio-termo defensável.

**O gatilho geral para reabrir**: um fluxo que precise de laço de tools com
estado. Enquanto uma feature for "monte contexto, chame uma vez, valide a
resposta", nenhum framework paga a própria superfície.

## Observabilidade: banco próprio e Langfuse, e por que os dois

Não existe padrão único no mercado. Langfuse é o líder do open source;
LangSmith é para quem usa LangGraph; Braintrust é eval-first; Arize Phoenix é
OTel-nativo. O que atravessa todos é que o OpenTelemetry tem convenções
semânticas de GenAI (`gen_ai.*`) e a maioria as ingere — o que mantém o backend
trocável. Elas seguem *pre-stable*, então os nomes ainda mudam.

A divisão adotada é por tipo de pergunta:

- **Custo e uso são domínio** e ficam em `ai.ai_run`, no mesmo banco do resto.
  "Quanto custou descrever FII em agosto" é um JOIN com `asset` e `asset_type`;
  numa plataforma externa seria um atributo de trace que alguém teve de lembrar
  de setar. Além disso nada sai da máquina, e nenhum serviço novo entra no
  deploy.
- **Dataset e experimento são ferramenta**, e o Langfuse resolve melhor do que
  vale construir: fixar vinte entradas, rodar o prompt v3 contra elas e comparar
  com o v2 lado a lado é a coisa de maior valor para aprender isto, e é um
  projeto inteiro se feito à mão.

**A fronteira que não pode borrar**: o prompt é gerenciado aqui e versionado
aqui. Se o Langfuse também gerenciasse prompt, seriam duas fontes de verdade
para o mesmo texto — e o admin deste app perderia a razão de existir.

O tracing é opcional: sem as chaves, `build_tracer()` devolve um no-op e nada
falha. Toda a dependência do Langfuse mora em `app/infra/ai/tracing.py`.

## Prompt no banco, e as travas que tornam isso seguro

Há um argumento forte para prompt em código, e ele merece ser registrado antes
da decisão contrária: **o prompt e o schema de saída são um artefato só**. Se o
schema muda e o prompt não, a geração quebra; com o prompt no banco e o schema
em código, um deploy pode dessincronizar os dois em silêncio.

A escolha foi banco, porque editar redação sem redeploy vale a pena. As três
travas que pagam por ela:

1. **O schema de saída fica em código** (`domain/outputs.py`), por feature, e o
   prompt jamais o define.
2. **Salvar uma versão valida os placeholders** contra as chaves de contexto que
   o handler declara. Um prompt que quebraria na geração não pode ser gravado —
   é isto que torna a tela segura, e `test_prompt_template.py` prova que a
   guarda dispara.
3. **O artefato guarda a versão que o gerou**, na chave única. Trocar de prompt
   invalida o cache sozinho.

Uma quarta, menor: o artefato guarda o `schema_version`, então um payload
gravado sob um schema antigo é ignorado na leitura em vez de estourar validação
numa tela.

## Corretude: quatro camadas, da mais barata para a mais cara

1. **Schema estrito** — o provedor restringe a geração, e o formato deixa de ser
   modo de falha. O schema é também a guarda de produto: não existe campo de
   recomendação em `AssetDescription`, então não há onde uma caber.
2. **Validação Pydantic no retorno** — mesmo com o schema enforçado, a resposta
   é parseada. Cobre o caso de a enforcement não ter acontecido: um provedor que
   ignorou o schema, ou uma cadeia que caiu para um elo que não o suporta.
3. **Cross-check contra dado próprio** — as fontes citadas têm de estar entre as
   páginas que a busca realmente trouxe. URL que o modelo escreveu de memória
   não chega ao card. E todo número vem da aplicação, nunca do modelo.
4. **Humano no meio para tudo que escreve** — o padrão do `research`: a saída é
   uma *leitura* até alguém confirmar. Nenhuma feature de IA escreve no
   portfolio hoje, e a que vier a escrever segue esse caminho.

**LLM-as-judge é a camada 5** e só paga com volume e um golden dataset alinhado
a rótulos humanos. Fica para quando houver duas versões de prompt disputando.

## RAG e fine-tuning: não, e o que faria mudar

**RAG — não.** Os dados aqui são estruturados e pequenos. O padrão certo para
"quanto tenho em FII" é uma query SQL colada no prompt: montagem determinística
de contexto, não busca por similaridade. RAG ganha o lugar dele quando existe um
corpo de texto não-estruturado maior do que a janela de contexto.

**O gatilho**: os OCRs de relatório de fundo e de empresa. Quando esses
documentos acumularem, buscar entre eles deixa de caber num prompt. Nota
prática: a imagem `postgres:14` do `docker-compose` não tem pgvector.

**Fine-tuning — não.** Compra aderência de formato e estilo. Formato já vem de
graça do schema estrito, e estilo é prompt. Custa um dataset rotulado que não
existe. **O gatilho**: um modelo barato falhar consistentemente numa tarefa
estreita *e* haver centenas de exemplos rotulados dela — e mesmo aí, tentar um
modelo melhor primeiro é mais barato que manter um treino.

## Segurança

- **Gasto** é o risco mais concreto: uma chave de API é um cartão sem limite. O
  teto diário (`AI_DAILY_COST_LIMIT_USD`) é checado antes da chamada, na camada
  de registro, então vale para todo chamador. A rota que gera é de superusuário
  — na v1 ela era aberta a qualquer autenticado, o que era gasto ilimitado.
- **PDF e conteúdo da web são entrada não-confiável.** O texto deles nunca é
  interpolado no system prompt, e nenhuma feature dá a um modelo uma tool que
  escreve. A saída estruturada ajuda aqui: não há campo por onde uma instrução
  injetada vire ação.
- **Chaves** ficam em `settings` e nunca no banco nem no frontend.
- O chatbot, quando existir, lê apenas, e escopado às carteiras do próprio
  usuário.

## O que ficou de fora, de propósito

- Geração assíncrona com fila e polling. Um app de um usuário quase nunca tem
  dois acessos simultâneos ao mesmo ativo, que era o que justificaria o dedupe;
  bloquear é mais simples, e o job agendado deixa o caso comum sendo um select.
- Aviso de "a IA pode cometer erros" nas telas. Quem lê este app é quem o
  escreveu e já sabe o que gerou aquilo; a frase repetida em toda tela ensina a
  ignorar a moldura junto com ela. A distinção é feita pelo desenho —
  `AiSurface` — e não por um disclaimer.
