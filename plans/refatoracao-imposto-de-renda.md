# Refatoração e robustez do imposto de renda

Status: etapas 2 e 3 entregues em 29/09/2026 para operações comuns, FII/Fiagro,
cripto em corretora brasileira e DARF (seção 11); fichas da declaração campo a
campo entregues no mesmo dia (seção 12), aguardando revisão das fontes.
Pendentes: exterior, day trade, bonificação com custo, e o que a seção 12 lista.
Revisão inicial do código e consulta a fontes oficiais: 23/09/2026.

Decisões confirmadas na discussão:

- Um CPF por usuário. A unidade da apuração é o usuário, agregando suas carteiras e corretoras; usuários distintos nunca compartilham bases ou saldos. Não criar uma nova entidade de titularidade sem necessidade.
- Há ativos mantidos há aproximadamente cinco anos. Priorizar regras atuais e evolução futura; reprodução de todas as declarações antigas não é prioridade. Importar o histórico necessário ao custo e aos saldos, ou aceitar abertura comprovada, sem aplicar regras atuais retroativamente para inventar prejuízos.
- DARF: apuração, dados para emissão no Sicalc e registro de pagamentos. Gerar o documento dentro do aplicativo não faz parte desta entrega.
- O imposto permanece no contexto de `portfolio`. Refatorar suas responsabilidades internamente, sem criar outro módulo de aplicação.

## 1. Resultado esperado

Entregar os valores dos investimentos que o contribuinte precisa informar na declaração anual e os dados para recolhimentos, todos originados da mesma apuração fiscal, reproduzível e fundamentada na regra vigente. As quatro abas atuais precisam funcionar; novas seções devem cobrir os rendimentos e regimes hoje ausentes.

“Todas as abas preenchidas” significa dados calculados ou informados com origem conhecida. Sem movimento, mostrar essa condição. Com informação insuficiente, mostrar a pendência e permitir completá-la; ausência não equivale a zero nem a isenção.

Premissa a confirmar: pessoa física residente fiscal no Brasil e escopo da declaração relativo a investimentos. Uma declaração completa também depende de salários, dependentes, despesas e outros bens. O módulo não pode afirmar que calculou o ajuste anual integral apenas com uma carteira.

## 2. Diagnóstico do que existe

Revisão estática, sem execução da aplicação, consulta a dados pessoais ou validação numérica contra informes reais.

| Evidência no repositório | Consequência / trabalho necessário |
| --- | --- |
| `frontend/src/pages/portfolio/tax-income/page.tsx`: DARF, Bens e Direitos, Apuração FIIs e Operações Comuns | Faltam rendimentos, day trade, exterior e detalhamento próprio de cripto. Seletor “Ano” confunde ano-calendário e exercício e limita a cinco anos. |
| `backend/app/lib/income_tax/constants.py`: alíquotas fixas e limites de R$ 20 mil / R$ 35 mil | As isenções já existem; falta vigência, enquadramento e validação histórica. Todo ETF é tratado a 15%, toda cripto a 15%. |
| `tax_income_calculator.py`: apenas lucro, vendas, tipo e prejuízo acumulado | Não há data de regra, regime, IRRF, pagamento ou distinção day trade. O mesmo carregamento de prejuízo é aplicado a cripto, o que precisa ser separado do regime de bolsa. |
| `portfolio_income_tax_service.py`: ações e ETFs/BDRs calculados separadamente, impostos somados depois | A compensação entre resultados legalmente compatíveis não acontece. A regra de isenção de ações deve ser aplicada antes da composição das bases tributáveis compatíveis. |
| `_calculate_tax`: recorte anual seguido de `ffill` | O cálculo percorre o histórico, mas meses iniciais sem movimento podem exibir zero de prejuízo apesar de saldo anterior. Precisamos de saldo de abertura explícito. |
| `backend/app/lib/finance/trade.py` | Custo e resultado usam quantidade e preço; ignoram `fees` e `withheld_income_tax`, embora `get_transactions` já os retorne. Float e ordenação apenas por data não bastam para uma memória fiscal precisa. |
| `_apply_split_events` em DARF e FIIs, ausente na apuração comum | As abas podem divergir. Eventos são aplicados sobre todas as transações anteriores e sem corte pelo período pedido; precisam ser processados cronologicamente, uma vez, conforme sua natureza. |
| DARF filtra Brasil pela moeda da corretora | Diverge da regra de mercado usada em Bens e Direitos; não é classificação fiscal confiável. Todas as criptos recebem rótulo “Brasil”. |
| `get_darf`: `tax == darf`; saída vazia é um objeto, saída preenchida é lista | Não há obrigação por código de receita, IRRF deduzido, mínimo de recolhimento, vencimento ou conciliação de pagamento. Caminhos sem transações de determinada classe também chegam a DataFrames vazios sem tratamento consistente. |
| `get_assets_and_rights` e `get_position_on_date_by_broker` | Usam `quantity * Position.price`, dependem de posição na data exata e não constroem custo fiscal. Auditar especialmente ações/cotas que devem ser declaradas pelo custo, observadas as regras da ficha. |
| Bens e Direitos: grupos/códigos fixos, exterior sempre país 249, cripto sempre 105 | País, subtipo e mapeamento da declaração precisam de dados explícitos e versão por exercício. O código atual não distingue adequadamente produtos de previdência ou fundos. |
| `_map_cnpj` usa corretora como fallback do emissor/fundo | Pode preencher um documento válido, mas da entidade errada. Mostrar falta do documento exigido; rever os testes que hoje exigem esse fallback. |
| Rendimentos isentos vêm de lista de tipos e são associados às posições de fim de ano | Não validam condições de isenção. O total por ativo pode se repetir entre corretoras; rendimentos de ativos vendidos antes das duas datas podem desaparecer. Apuração de rendimentos deve existir independentemente da posição em 31/12. |
| Componentes fiscais usam `useEffect`, API direta e estado local | Divergem da regra de TanStack Query do `frontend/CLAUDE.md`. Falhas só registradas no console podem deixar informação anterior na tela. |

Testes encontrados: `backend/tests/modules/portfolio/test_income_tax_issuer_and_market.py` e `frontend/e2e/tax-income.spec.ts`. Eles são úteis, mas não demonstram correção fiscal integral; alguns fixam comportamentos que precisam de revisão legal.

## 3. Matriz legal inicial

As referências abaixo estabelecem a direção. Antes de implementar cada família, registrar artigo/item, início e fim de efeitos, transições e exemplos no catálogo de regras. A publicação de uma página da Receita não é o início de vigência da lei. Não extrapolar a regra atual para anos anteriores nem incorporar projetos de lei como regras aprovadas.

| Família | Regra / distinção a implementar | Fontes |
| --- | --- | --- |
| Ações no mercado à vista brasileiro | Operações comuns: 15% sobre base tributável; isenção para vendas mensais até R$ 20 mil nas hipóteses legais, considerando o contribuinte e todas as corretoras. O limite é de vendas, não de lucro. Separar ganho isento de resultado tributável. | [Isenções](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/isencoes), [IN 1.585](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=67494) |
| ETF de ações / BDR / day trade | Não estender a isenção das ações aos ETFs de ações ou BDRs. Separar operações comuns e day trade, com compensações e retenções próprias. Não inferir day trade simplesmente pela existência de compra e venda: tratar quantidades casadas, intermediário e demais condições legais. | [IN 1.585](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=67494), [Compensações](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/compensacoes) |
| ETF de renda fixa | Regime distinto, com retenção e alíquotas de 25%, 20% ou 15% conforme prazo médio de repactuação da carteira. Não aplicar o motor de ETF de ações por compartilhar o tipo `ETF`. | [MAFON 2025](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/irrf/mafon-2025.pdf/@@download/file) |
| FII / FIAGRO | Separar resultado de alienação de distribuição de rendimentos. Para FII, ganho de alienação tem regime de 20%, sem isenção mensal das ações; rendimentos só são isentos quando cumpridas as condições legais. FIAGRO exige enquadramento próprio, inclusive histórico, antes de compartilhar regras. | [Lei 11.033, art. 3º](https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11033compilado.htm), [IN 1.585](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=67494) |
| IRRF e prejuízos | Saldos separados por regime e origem. Perda posterior não reduz lucro de mês anterior. IRRF não é despesa; possui regras próprias de utilização e encerramento anual, distintas de prejuízos. | [Retenções](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/retencoes), [Compensações](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/compensacoes) |
| Criptoativos | Classificar custódia/localização e natureza antes de escolher o regime. Quando sujeitos a ganho de capital, tratar isenção mensal aplicável, faixas progressivas e código 4600; não reutilizar indiscriminadamente compensação de bolsa. Permutas também precisam ser avaliadas. Os enquadrados como aplicação financeira no exterior seguem a regra correspondente. | [Perguntas IRPF 2026](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirpf/p-r-irpf-2026-v1-00-2026-04-23.pdf), [Alíquotas de ganho de capital](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/ganhos-de-capital/aliquotas), [Perguntas sobre exterior](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2024/abril/receita-federal-e-secretaria-da-reforma-tributaria-lancam-atualizacao-do-perguntas-e-respostas-sobre-tributacao-de-rendimentos-no-exterior/perguntas-e-respostas-offshores-lei-14-754-e-in-rfb-2-180.pdf) |
| Aplicações financeiras no exterior | Desde 2024, regime anual de 15% nos termos da Lei 14.754; tratar realização, rendimentos, câmbio, perdas elegíveis e crédito de imposto no exterior. Períodos anteriores exigem regras próprias. Não gerar automaticamente DARF mensal de bolsa para esses rendimentos. | [Lei 14.754](https://www.presidencia.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14754.htm), [Perguntas sobre exterior](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2024/abril/receita-federal-e-secretaria-da-reforma-tributaria-lancam-atualizacao-do-perguntas-e-respostas-sobre-tributacao-de-rendimentos-no-exterior/perguntas-e-respostas-offshores-lei-14-754-e-in-rfb-2-180.pdf) |
| Dividendos a partir de 2026 | Considerar retenção de 10% quando ultrapassado o limite mensal de R$ 50 mil da mesma pessoa jurídica para a mesma pessoa física, observadas transições/exceções. Tributação mínima anual de altas rendas exige informação fora da carteira; exercício 2027 não pode reutilizar cegamente a declaração 2026. | [Lei 15.270, arts. 6º-A e 16-A introduzidos na Lei 9.250](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15270.htm) |
| Renda fixa, fundos e previdência | Classificar rendimentos isentos, exclusivos e tributáveis; conciliar retenções, amortizações, resgates e eventual come-cotas. PGBL/VGBL e tipos de fundos não podem ser decididos por um único tipo genérico. Levantamento detalhado por produto é entrega da fase 1. | [IN 1.585](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=67494), [Lei 14.754](https://www.presidencia.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14754.htm) |
| DARF | Separar obrigação, recolhimento e informação anual; consolidar por contribuinte/código/período. Valores abaixo de R$ 10 acumulam para o mesmo código conforme a regra, sem serem rotulados isentos. Validar vencimentos e encargos com o Sicalc. | [Sicalc e valor mínimo](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/pagamentos-e-parcelamentos/darf-calculo-e-impressao-programa-sicalc-1), [Rendimentos do capital — código 6015](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/rendimentos-do-capital) |

Complementar a matriz com JCP, aluguel de ativos, bonificações, subscrições, incorporações, cisões, transferências e amortizações conforme os produtos/histórico confirmados. Não presumir que todo evento seja split. Declarações acessórias de cripto são obrigação distinta de IRPF/DARF e terão cobertura explicitada, inclusive mudanças de leiaute e vigência.

## 4. Organização proposta

Manter a apuração fiscal em `backend/app/modules/portfolio/`, conforme decisão do mantenedor. A agregação das carteiras do mesmo usuário é uma responsabilidade desse contexto e não exige outro módulo. Usar o vínculo existente entre usuário e carteiras.

Respeitar as camadas já existentes:

- `portfolio/domain/income_tax/`: motor fiscal puro, tipos de entrada/saída, seleção de regra vigente, custo fiscal, apuração por regime e saldos; funções determinísticas, sem SQLAlchemy, HTTP ou consulta a provedor.
- `portfolio/service/`: reduzir `PortfolioIncomeTaxService` à coordenação da leitura de fatos por `UnitOfWork` e execução da apuração por usuário. Separar a montagem dos relatórios do cálculo, em funções dedicadas que recebem o resultado tipado e o exercício.
- `portfolio/repositories/`: consultas de fatos, complementos, pagamentos e versões de apuração conforme necessário, acessadas pelo UoW. Manter negócio fora das consultas e a persistência fiscal sob responsabilidade de `portfolio`.
- `portfolio/api/income_tax/` e `app/composition/portfolio.py`: contratos tipados, autorização por usuário e montagem dos serviços, aproveitando a organização existente.
- Persistência e mappings em `infra/db/`, conforme o padrão do projeto.

O fluxo único será: fatos e saldos de abertura → motor fiscal → resultado de apuração → relatórios mensais, DARF e declaração anual. As abas não executam versões próprias do cálculo. Compartilhar a definição e o resultado da apuração não exige cache ou persistência de toda leitura; persistir versões quando necessário para preservar histórico declarado/pago.

Substituir os contratos implícitos de DataFrames por tipos explícitos na fronteira do motor: operações normalizadas, saldos por regime, regras aplicadas, resultados por período e pendências. DataFrames podem continuar em adaptações locais, mas não definir o contrato fiscal por colunas adicionadas durante o processamento. Respostas HTTP devem ter schemas estáveis também quando vazias, com serialização monetária explícita.

Não reescrever o cálculo de performance junto. A base fiscal é separada do preço usado para rentabilidade. Adaptar fatos existentes e migrar consumidores fiscais; substituir os caminhos antigos apenas quando todas as abas estiverem usando a apuração única.

Recomendação inicial para regras: fórmulas explícitas e catálogo tipado de parâmetros/vigências versionado em código, revisado junto dos testes. Evitar um interpretador genérico de fórmulas ou editor administrativo nesta refatoração. Caso edição em tela se torne requisito, discutir separadamente persistência de versões imutáveis com as mesmas validações.

Migrar as regras de `app/lib/income_tax/` para o domínio fiscal interno de `portfolio` conforme seus consumidores forem convertidos. O cálculo financeiro compartilhado em `app/lib/finance/trade.py` deve ser auditado quanto aos consumidores: extrair ou substituir apenas o caminho fiscal, preservando as necessidades de performance. Separação de responsabilidades é o objetivo; mover arquivos sozinho não resolve as divergências.

## 5. Regras ao longo do tempo

Cada versão deve declarar:

- Identidade da família/regime e revisão imutável.
- Início inclusivo e fim exclusivo dos efeitos; separar data de publicação, vigência/produção de efeitos e data em que a aplicação incorporou a regra.
- Enquadramento: residência fiscal, mercado/país, produto/subtipo, operação, evento e condições de isenção.
- Alíquota ou faixas, limite, base e agregação do limite, periodicidade, compatibilidade de compensações e retenções, código de receita e vencimento.
- Qual data seleciona a regra: negociação, recebimento, resgate ou outro fato gerador previsto. Não usar a data atual do servidor.
- Fonte legal, artigo/item, transição, data de conferência e casos de teste associados.

Proibir sobreposição ambígua para o mesmo enquadramento; ausência de regra para um período deve produzir pendência identificável, nunca cair na versão mais recente. Mudanças de fórmula e de condições também são versões, não apenas trocas de percentuais.

Exemplo exclusivamente hipotético solicitado: ETF de ações passa de 15% para 20% em uma data futura D. A versão anterior termina em D e a seguinte inicia em D; operação anterior continua com a regra antiga ao recalcular. Não cadastrar essa mudança como lei real. Se a vigência mudar dentro de um mês, selecionar a regra por fato e respeitar a disposição de transição antes de agregar.

Versionar separadamente o mapeamento da declaração por exercício: ficha, grupo/código, campos, identificação exigida, forma de discriminação e limites de obrigatoriedade. Uma mudança no formulário não altera o imposto calculado no fato gerador.

Guardar na apuração a revisão do motor, versões legais e identificação das entradas. Correção de cadastro, transação ou regra deve permitir comparar a nova apuração à anterior. Valores já declarados/pagos precisam continuar consultáveis.

## 6. Dados necessários e fluxo de cálculo

1. Identificar usuário/contribuinte, residência fiscal no período e todas as suas carteiras pelo vínculo existente. Agregar todas as corretoras; filtro visual de carteira não pode criar uma nova isenção. Evitar dupla contagem de operações importadas em carteiras diferentes; nunca aceitar acesso a dados de outro usuário por um ID fornecido na requisição.
2. Carregar histórico suficiente para custo e saldos ou saldos de abertura comprovados: quantidade, custo, prejuízos por regime, IRRF elegível e imposto abaixo do mínimo. Registrar origem e data dos ajustes manuais sem duplicá-los com histórico importado depois.
3. Normalizar transações, notas e eventos em ordem determinística; tratar transferências sem venda fictícia, taxas uma única vez, desdobramentos e demais eventos na data correta. Separar amortização de rendimento.
4. Classificar operações e casamentos de day trade antes do custo/resultado comum. Quando faltarem dados para classificar, abrir pendência em vez de presumir operação comum.
5. Calcular em `Decimal`, com precisão de quantidade/preço/custo e arredondamento monetário documentados por etapa. Não arredondar custo médio a centavos a cada compra.
6. Selecionar regras por fato gerador; apurar vendas elegíveis à isenção, resultado, ganho isento, perdas compensáveis, base tributável, imposto e retenções. Grupos fiscais de compensação são distintos dos tipos de ativo da UI.
7. Produzir doze competências com saldos de abertura e fechamento, incluindo meses sem venda. Apurações anuais próprias seguem o regime, sem transformação artificial em DARF mensal.
8. Gerar obrigações por código/competência, carregar valores abaixo do mínimo e conciliar pagamentos reais. Pagamento nunca é inferido porque o imposto foi calculado.
9. Projetar o mesmo resultado para declaração anual e abas mensais, com ligação do total às operações, ajustes e regra aplicados.

Ampliar dados somente conforme a matriz: país real, custódia, subtipo fiscal, fonte pagadora/documento, bruto/líquido/IRRF, retenção comum/day trade, informes, imposto estrangeiro e câmbio fiscal com origem/data/direção. Reaproveitar `fees` e `withheld_income_tax` existentes, auditando antes seu rateio em notas mistas.

## 7. Abas e conteúdo de entrega

| Seção | Conteúdo que deve refletir a declaração / recolhimento |
| --- | --- |
| Resumo e pendências | Ano-calendário e exercício explícitos, contribuinte, cobertura, conciliação, saldos e dados faltantes. A seção pode ser um resumo acima das abas. |
| Bens e Direitos | Ficha/grupo/código do exercício, país, identificação correta, discriminação copiável e valores fiscais das duas datas. Incluir bens encerrados quando exigido; não depender de cotação em 31/12. |
| Rendimentos | Isentos, exclusivos/definitivos e tributáveis, agrupados como a ficha exige, por fonte pagadora/beneficiário; rendimentos de ativos já vendidos também aparecem. Separar dividendos, JCP, fundos, renda fixa e previdência conforme regime. |
| Operações Comuns | Meses e modalidades que a declaração exige: vendas, lucro/prejuízo, ganho isento, prejuízo anterior/utilizado/final, base, imposto, IRRF e imposto pago. Detalhe por ativo para conferência. |
| Day trade | Demonstrativo próprio com casamento e custos auditáveis, sem misturar saldos com operações comuns. |
| FII / FIAGRO | Resultados e saldos segregados conforme regime validado; rendimentos distribuídos vão também à ficha correspondente, sem duplicação. |
| Exterior | Aplicações, rendimentos realizados, câmbio, perdas e crédito estrangeiro; apresentação anual ou histórica conforme vigência. |
| Criptoativos / Ganhos de capital | Alienações e permutas, enquadramento, isenção/base/faixas e destino da informação: declaração, GCAP e DARF quando aplicável. |
| DARF e pagamentos | Código (por exemplo, 6015 ou 4600 conforme obrigação), período, vencimento, principal, IRRF abatido, acumulado abaixo do mínimo, pagamentos e saldo. Encargos em separado, com data de referência e cálculo validado no Sicalc. |

Preservar as funções das quatro abas atuais. Proposta: agrupá-las em “Declaração anual” e “Apuração e DARF” se a quantidade de abas dificultar uso; confirmar no bate e volta. Copiar/exportar demonstrativos é parte da entrega; transmissão à Receita ou arquivo importável exige especificação oficial própria e não está presumida.

Na tela, distinguir “isento”, “sem movimento”, “prejuízo”, “compensado”, “abaixo do mínimo”, “pago” e “pendente”. Exibir alíquota da regra, não `DARF / lucro`, que se altera por compensações. Valores fiscais em BRL independem do seletor de moeda de rentabilidade.

Mover leituras para `src/queries/`, com chaves contendo titular/escopo, ano e parâmetros necessários; evitar dados do contribuinte/ano anterior durante erro ou troca de filtro. Componentes de domínio recebem dados por props e usam o design system existente.

## 8. Etapas e critérios de saída

1. **Fechar cobertura e matriz legal.** Confirmar anos, titularidade e produtos; completar artigos, vigências e regras por produto/exercício. Elaborar exemplos numéricos independentes do código. Saída: nenhuma família prometida com regra indefinida.
2. **Fundação fiscal dentro de portfolio.** Motor puro, catálogo temporal, contratos tipados, classificação e saldos de abertura; completar dados necessários. Saída: enquadramento verificável e seleção temporal inequívoca, com responsabilidades separadas dentro do módulo existente.
3. **Cálculo de bolsa e DARF.** Custos, day trade, compensações, eventos, IRRF, mínimo e pagamentos. Saída: apuração comum/FII/DARF reconciliada com os mesmos fatos e sem divergência entre abas.
4. **Declaração anual e demais regimes.** Custo fiscal, rendimentos, exterior, cripto, fundos/renda fixa/previdência e mapeamentos por exercício. Saída: todos os produtos do escopo possuem destino fiscal explícito e fontes reconciliadas. A fase 3 isolada não conclui o pedido.
5. **Migrar interface e contratos.** Abas, memória de cálculo, pendências e exportação. Rotas atuais podem delegar temporariamente ao novo serviço para migração coordenada. Saída: frontend sem regra fiscal duplicada.
6. **Validar migração e substituir cálculo antigo.** Comparar legado/novo e classificar diferenças esperadas, conciliar amostra com informes/notas/declarado e pagamentos, preservar histórico anterior. Remover implementação substituída sem retirar funções. Atualizar `docs/domain.md`, `docs/architecture/overview.md` e contratos afetados no mesmo trabalho.

Sem prazo fechado antes do retorno sobre histórico/produtos e da avaliação das lacunas de dados. Implementar em entregas pequenas, cada uma com exemplos fiscais e contratos conferidos. Começar a migração funcional pela apuração compartilhada de operações comuns e DARF; depois incorporar as demais projeções/regimes. Cada caminho antigo só é retirado após a migração de seus consumidores e validação por exemplos numéricos independentes do motor.

## 9. Verificação dirigida

Fixtures calculadas independentemente do motor, com fonte legal e expectativa em centavos:

- Vendas de ações em R$ 19.999,99, R$ 20.000 e R$ 20.000,01; agregar duas corretoras/carteiras do mesmo titular; separar CPF diferente.
- Ganho isento não consome prejuízo; perda em mês com vendas abaixo do limite segue a regra própria. Compensação comum entre classes compatíveis e isolamento de day trade/FII/exterior.
- Prejuízo em dezembro, janeiro sem movimento e lucro posterior; perda futura não altera imposto devido passado.
- Taxas de compra/venda, rateio de nota mista, IRRF comum/day trade, saldo de dezembro e tratamento no ano seguinte; nenhum crédito usado duas vezes.
- DARF de R$ 9,99 e R$ 10,00, acúmulo por código, virada do ano, vencimento em dia não útil, pagamento parcial, atraso e pagamento repetido.
- Mesmo ativo em duas corretoras, transferência, split, amortização, bonificação e venda parcial; evento futuro não altera relatório passado.
- Bens pelo valor fiscal aplicável, sem cotação em 31/12, adquirido/vendido no mesmo ano, posição só em um dos anos, rendimento sem posição final, documento do emissor ausente.
- Cripto nas bordas da isenção e das faixas; permutas; distinção ganho de capital/aplicação exterior sem carregar prejuízo de bolsa.
- Transição exterior 2023/2024 quando incluída no histórico; dividendos 2025/2026 e transições pertinentes; ausência de dados para tributação mínima anual não vira cálculo completo.
- Regra hipotética ETF 15%/20% imediatamente antes/em/depois de D, sem mudar resultado histórico; sobreposição e lacuna do catálogo devem ser detectadas.
- Carteira vazia e classes sem transações: contrato estável e resultado correto; troca de ano/titular sem resposta antiga; valores não calculáveis não rotulados isentos.

Nesta fase documental não há testes de aplicação a executar. Na implementação: teste mais próximo e ruff nos arquivos backend; tsc e ESLint nos arquivos frontend conforme `CLAUDE.md`. Contratos/arquitetura quando a mudança tocar suas fronteiras; suíte ampla nos hooks locais. Não executar regressão visual fora da máquina do mantenedor.

## 10. Bate e volta

Primeira rodada concluída: um CPF por usuário; histórico de aproximadamente cinco anos sem prioridade em reproduzir declarações antigas; dados para Sicalc e registro de pagamentos. Essas decisões estão incorporadas acima.

Discussão de código concluída: manter imposto dentro de `portfolio`, separando motor fiscal puro, coordenação da apuração por usuário e projeções para relatórios. Incorporar contratos tipados, precisão monetária, regras temporais e migração gradual; não criar um módulo de aplicação separado.

Próxima decisão: como completar as informações que não estão nas transações. Proposta: oferecer lançamento manual estruturado de informes, rendimentos, IRRF e saldos iniciais com origem registrada, além de reaproveitar a importação de notas já existente. Importação automática de novos formatos de informes pode ser uma entrega posterior; sem esses dados não é possível preencher todas as fichas corretamente.

Ainda precisamos confirmar quais classes/operações o usuário utiliza e se existem investimentos fora do sistema. A lista de tipos já suportados pelo produto é a cobertura candidata; nada será descartado por falta de resposta. Residência fiscal e alcance das fichas de investimentos também permanecem como premissas a confirmar.

Recomendação de organização: visão fiscal do usuário, com “Declaração anual” e “Apuração e DARF”, mantendo detalhamento por carteira para conferência. Catálogo de regras inicialmente em código, sem editor administrativo. Não é necessário compartilhar CPF ou documentos pessoais para decidir a arquitetura.

Decisões ainda propostas: catálogo em código; foco inicial em PF residente e fichas de investimentos; lançamentos complementares manuais. Nenhuma dessas hipóteses autoriza descartar classes existentes ou declarar cobertura fiscal integral antes das validações descritas.

## 11. Entrega de 29/09/2026

Decisões da segunda rodada, tomadas com o mantenedor:

- A apuração soma **todas** as carteiras do usuário; não há carteira de teste
  que duplique operações.
- O histórico de bolsa está completo no app: prejuízo e custo saem só das
  transações, sem lançamento de saldo inicial.
- Opera-se ações/ETF de ações/BDR, FII/Fiagro e ETF de renda fixa. Day trade
  não: aparece como pendência se as transações mostrarem um.
- Cripto entra já, e é custodiada em corretora brasileira: ganho de capital,
  isenção de R$ 35 mil no mês, faixas progressivas, DARF 4600, sem compensar
  perda. Cripto em corretora de base dólar vira pendência (regime anual da
  Lei 14.754, não apurado).
- Bonificação sem custo atribuído: o evento não ganhou campo novo; a ação
  bonificada entra com custo zero e a apuração mostra a pendência.

Entregue:

- Motor puro em `backend/app/modules/portfolio/domain/income_tax/`: catálogo de
  regras com vigência e fonte (`rules.py`), classificação fiscal do ativo
  (`trades.py`), custo médio do contribuinte com taxas e eventos (`ledger.py`),
  apuração mensal por regime com isenção, compensação e IRRF (`assessment.py`),
  DARF com mínimo de R$ 10, vencimento e pagamentos (`darf.py`, `calendar.py`),
  pendências (`pendency.py`), e a junção em `report.py`. Tudo em `Decimal`.
- `GET /portfolio/income_tax/assessment?fiscal_year=` e o registro de
  pagamentos em `/portfolio/income_tax/darf_payment` (tabela
  `portfolio.darf_payment`). As rotas antigas de DARF, apuração de FII e de
  operações comuns, e `app/lib/income_tax/`, foram removidas.
- Tela com as abas DARF (situação, vencimento, pagamento), Operações comuns,
  FII e Fiagro, Cripto e Bens e Direitos, pendências acima das abas, leituras
  em `src/queries/incomeTax.ts`.
- Exemplos calculados à mão em
  `backend/tests/modules/portfolio/test_income_tax_assessment.py` (limites de
  20 mil e 35 mil nas bordas, compensação, IRRF, mínimo, vencimentos, eventos,
  catálogo) e as rotas em `backend/tests/e2e/test_income_tax.py`.

Diferenças esperadas contra o cálculo antigo, todas intencionais: taxas passam a
entrar no custo e na venda; ETF/BDR compensam prejuízo com ações no mesmo mês;
ETF de renda fixa sai do DARF; cripto deixa de compensar prejuízo e ganha
faixas; o prejuízo e o limite passam a somar todas as carteiras; o DARF abaixo
de R$ 10 passa a acumular.

Fontes: nesta sessão o acesso a gov.br e aos portais de legislação estava
bloqueado na rede. As regras foram conferidas por fontes secundárias que citam a
Receita (compensação de prejuízo em mês isento, isenção e faixas de cripto,
queda da MP 1.303/2025). Conferir os artigos citados em `rules.py` contra o
texto oficial antes de declarar.

Ainda não coberto: Bens e Direitos pelo custo e na visão do contribuinte
(etapa 4); rendimentos (dividendos, JCP, FII) na ficha própria; exterior (Lei
14.754); day trade; FI-Infra e outros fundos listados; custo de bonificação;
exportação dos demonstrativos; mapeamento da declaração por exercício.

## 12. Fichas da declaração, campo a campo (29/09/2026)

O programa do IRPF não importa arquivo de terceiros — só a declaração anterior
(`.DEC`), a pré-preenchida e arquivos dos programas da Receita (GCAP). Então a
tela passou a espelhar as fichas: uma aba por ficha, os campos na ordem do
programa, um botão de copiar em cada um (valor copiado sem separador de milhar).
Desde o IRPF 2026 a pré-preenchida já traz a renda variável com IRRF e DARFs
pagos; o uso pensado é começar por ela e conferir/completar com o app.

Entregue:

- **Bens e Direitos** pelo custo, na visão do contribuinte: um item por ativo e
  corretora com posição em algum dos dois 31/12, custo médio do CPF vezes a
  quantidade na corretora. O Bens e Direitos antigo (por carteira, a mercado) e
  sua rota foram removidos.
- **Rendimentos Isentos**: 20 (ações até R$ 20 mil), 05 (cripto até R$ 35 mil),
  09 (dividendos por empresa), 99 (FII/Fiagro por fundo), 12 (cupons de
  CRI/CRA/LCA lançados como provento).
- **Tributação Exclusiva**: 10 (JCP por empresa, valor líquido) e 06 (cupons de
  CDB/debênture/Tesouro lançados como provento). Para separar dividendo de JCP,
  o provento ganhou o campo tipo (`portfolio.dividend.kind`), escolhido no
  formulário de proventos; tudo o que existia virou dividendo.
- **Renda Variável** (operações comuns e FII/Fiagro): mês a mês, com o
  resultado líquido sem o ganho isento e o imposto pago repartido quando um DARF
  6015 juntou os dois regimes.
- **Ganhos de Capital**: as vendas de cripto dos meses tributados, no formato do
  GCAP.
- **Imposto Pago/Retido**: o IRRF (Lei 11.033) que sobrou no ano.

Para revisar contra o texto oficial (gov.br bloqueado nesta sessão):

- Códigos de Bens e Direitos usados: 03-01 ações (inclusive exterior), 04-02
  tributados (CDB, Tesouro, debênture), 04-03 isentos (LCI, LCA, CRI, CRA),
  04-04 BDR, 07-01 fundos com come-cotas, 07-03 FII, 07-08 ETF de renda fixa,
  07-09 ETF de renda variável, 08-01 bitcoin, 08-02 altcoins, 08-03
  stablecoins. Incertos e marcados na tela: Fiagro, ETF e REIT no exterior,
  fundo sem come-cotas, debênture incentivada, VGBL/PGBL.
- Códigos de rendimento: 20, 05, 09, 12, 99 (FII) isentos; 10 e 06 exclusivos.
- Nomes e ordem dos campos da ficha Renda Variável, e se o IRRF da Lei 11.033 é
  abatido no mês pelo programa ou só na ficha Imposto Pago/Retido.
- Se bens comprados e vendidos no mesmo ano precisam aparecer com situação
  zerada (hoje não aparecem).
- CNPJ pedido para renda fixa e Tesouro (hoje: o da corretora custodiante).
- Campos do GCAP para criptoativo.

## 13. Conferência contra o texto oficial (30/09/2026)

Fontes: Perguntas e Respostas IRPF 2026 da Receita (v1.00, 23/04/2026; 745
perguntas), guia IRPF 2026 do Santander e do CRC-RS, e guias de corretoras
para o que o P&R não tabela.

Corrigido:

- **Fiagro** tem código próprio: **07-02** (antes ia em 07-03 com nota).
- **ETF de renda variável** no Brasil é **07-06** ("FIP, FIDC e ETF –
  Entidade de investimento", Lei 14.754/2023), não 07-09.
- **Fundo sem come-cotas**: a nota agora diz o código certo — fundo de ações
  07-04, FI-Infra 07-10, multimercado do art. 25 da Lei 14.754 07-13.
- **Bem comprado e vendido no ano** entra em Bens e Direitos com as duas
  situações zeradas. O P&R manda relacionar "os bens e direitos adquiridos e
  alienados no decorrer do ano-calendário".
- Nomes dos códigos 04-02, 04-03, 04-04, 07-08, 07-99 e 08-01 alinhados à
  tabela.

Confirmado como estava:

- 03-01, 04-02, 04-03, 04-04, 07-01, 07-03, 07-08, 08-01/02/03 (grupo 08 tem
  ainda 10 NFT e 99 outros; a discriminação pede custodiante com CNPJ).
- Rendimentos isentos: 20, 05, 09, 12 e **99 – Outros** para FII/Fiagro (o P&R
  usa 99; guias que dizem "26 – Outros" não batem com o texto oficial).
  Exclusivos: 10 JCP e 06 aplicações financeiras.
- IRRF de 0,005% (Lei 11.033): compensado no imposto mensal da apuração (P&R
  706); o que sobra no ano vai para Imposto Pago/Retido. IRRF de day trade só
  compensa até dezembro do mesmo ano (P&R 715).
- MP 1.303/2025 (alíquota única de 17,5%) caiu na Câmara: o catálogo de regras
  de 2026 segue o de 2025.

Em aberto (decisão do mantenedor):

- **Lei 15.270/2025**: a partir de 01/2026, dividendos acima de R$ 50 mil no
  mês, da mesma empresa para a mesma pessoa, têm IRRF de 10% sobre o total,
  compensável no ajuste; e há o imposto mínimo para renda acima de R$ 600 mil.
  Afeta a declaração de 2027 (ano-calendário 2026). O app hoje trata todo
  dividendo como isento, código 09.
- Criptoativo só é obrigatório em Bens e Direitos a partir de R$ 5.000 de
  custo por tipo; o app lista todos.
- CNPJ pedido para CDB/Tesouro (emissor vs. custodiante) e campos do GCAP para
  cripto: não achei texto oficial que feche.
- ETF e REIT no exterior: seguem com nota (Lei 14.754 — aplicação financeira
  no exterior).
