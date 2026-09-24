from dataclasses import dataclass

#: Uma nota com cem linhas e o resumo cabe com folga. Um PDF de extrato mensal
#: com vários pregões é o caso que pede mais.
EXTRACTION_MAX_TOKENS = 16000

_SYSTEM = (
    'Você transcreve notas de corretagem, confirmações de operação de bolsa e as '
    'aplicações e resgates em fundos que um extrato de conta mostra. Você '
    'copia o que o documento diz, e nada além disso: não calcula total que ele não '
    'imprime, não completa linha ilegível e não corrige número que parece errado. Um '
    'campo que o documento não traz vem nulo.'
)

_INSTRUCTIONS = """\
Transcreva as notas deste documento. Ele pode trazer uma nota ou várias — uma
por pregão, ou por folha. Cada nota vira uma entrada em `notes`; uma nota que
continua em várias folhas é uma entrada só. Cláusulas, termos legais e legendas
de códigos não são notas.

Os documentos vêm em três formatos.

**Nota de corretagem brasileira (layout Sinacor)** — Nubank, XP, BTG e a maioria
das corretoras do Brasil. Cabeçalho com "Nr. nota", "Data pregão" e a corretora
(nome e CNPJ); a tabela "Negócios realizados"; e os quadros "Resumo dos negócios"
e "Resumo financeiro". É em reais: `currency` = "BRL".

- Cada linha de "Negócios realizados" é uma entrada de `lines`, na ordem da nota.
  Não agrupe linhas do mesmo papel: cada execução é uma linha.
  - `side`: a coluna C/V. `market`: o "Tipo mercado" (VISTA, FRACIONARIO…).
  - `security`: a "Especificação do título" como escrita, por exemplo "PETROBRAS
    PN N2" ou "XPML11 CI ER", sem a coluna "Obs." (#, @, D, 2) e sem a quantidade.
  - `ticker`: só o código B3, sem sufixos (PETR4, ITSA4, XPML11). Se a
    especificação já começa pelo código, é esse. Se traz só o nome, informe o
    código que o nome descreve; sem certeza, deixe nulo.
  - `quantity`, `price`, `value`: quantidade, preço/ajuste e valor da operação.
  - `fees`: nulo — neste formato os custos estão no resumo.
- `purchases_total` (Compras à vista), `sales_total` (Vendas à vista),
  `operations_total` (Valor das operações).
- Custos do resumo financeiro: `settlement_fee` (Taxa de liquidação),
  `registration_fee` (Taxa de registro), `emoluments` (Emolumentos),
  `other_exchange_fees` (Taxa de termo/opções mais Taxa A.N.A.), `brokerage`
  (Taxa operacional, Corretagem ou Clearing, mais Execução), `iss` (ISS ou
  Impostos), `other_costs` (Custódia mais Outros).
- `withheld_income_tax`: o valor do "I.R.R.F. s/ operações" — não a base.
- `settlement_date` e `net_amount`: a data e o valor de "Líquido para"; o valor
  é positivo quando a nota marca crédito (C) e negativo quando marca débito (D).

**Confirmação de operação americana** — Avenue, Apex Clearing e corretoras dos
EUA ("Transaction Confirmation"). Uma tabela com Acct Type, B/S, Trade Date,
Settle Date, QTY, SYM, PRICE, Principal, COMM, Tran Fee, Add'l Fees, Net Amount,
e um "Summary for current trade date". É em dólar: `currency` = "USD".

- `broker_name`: a corretora que atende a conta ("Office serving you", por
  exemplo "AVENUE SECURITIES LLC"), não a clearing. `broker_cnpj`: nulo.
- `note_number`: nulo — o "Trade#" se repete entre linhas e não identifica a
  confirmação.
- `trade_date` e `settlement_date`: as colunas Trade Date e Settle Date, em
  `YYYY-MM-DD` (09/21/26 é 2026-09-21: mês, dia, ano).
- Cada linha da tabela é uma entrada de `lines`:
  - `side`: B é "C", S é "V". `market`: nulo.
  - `ticker`: a coluna SYM, exatamente. `security`: o texto de "Desc:".
  - `quantity`: QTY, com todas as casas decimais. `price`: PRICE. `value`: Principal.
  - `fees`: COMM mais Tran Fee mais Add'l Fees da linha.
- `purchases_total` e `sales_total`: TOTAL DOLLARS BOUGHT e TOTAL DOLLARS SOLD.
- `operations_total`, os custos do resumo, `withheld_income_tax` e `net_amount`:
  nulos — este formato não os imprime para a nota inteira.

**Extrato de conta com fundos de investimento** — o "Extrato da Conta
Investimento" do BTG e extratos parecidos. Não é uma nota: é um relatório do
período, e a compra ou venda de cotas está só na tabela "Fundo de Investimento
- Movimentação", uma por fundo, com Data, Transação, Quantidade de Cotas, Valor
da Cota, Valor Bruto, IR, IOF e Valor Líquido. É em reais: `currency` = "BRL".

- Transcreva só as linhas de APLICAÇÃO e de RESGATE dessa tabela. Come-cotas,
  amortização e as linhas "Total de…" não são operações.
- Ignore as outras seções: "Posição", "Detalhamento" (repete a mesma compra, por
  data de compra), "Rentabilidade" e "Conta corrente". Transcrever o
  detalhamento duplicaria a operação.
- Cada data de movimentação é uma entrada de `notes`, com as linhas daquela data
  de todos os fundos. `trade_date`: essa data (17/09/26 é 2026-09-17).
- `broker_name`: a instituição do extrato (por exemplo "BTG Pactual"); `broker_cnpj`
  só se o extrato imprimir o CNPJ dela. `note_number` e `settlement_date`: nulos.
- Cada linha:
  - `side`: APLICAÇÃO é "C", RESGATE é "V". `market`: "FUNDO".
  - `security`: o nome do fundo como escrito no título da tabela, por exemplo
    "PLGN Equipe FICFIDC". `ticker`: nulo — fundo não tem código de negociação.
  - `fund_cnpj`: o CNPJ impresso junto ao nome do fundo ("Classe CNPJ: …" ou
    "CNPJ: …"), como escrito. Procure-o nas outras seções se a tabela de
    movimentação não o repetir.
  - `quantity`: a Quantidade de Cotas, com todas as casas decimais (13697.925404).
    `price`: o Valor da Cota, com todas as casas. `value`: o Valor Bruto.
  - `fees`: o IOF da linha; nulo se for "-".
- `withheld_income_tax`: a soma do IR dos resgates da data; nulo se não houver.
- `purchases_total`, `sales_total`, `operations_total`, os custos do resumo e
  `net_amount`: nulos — o extrato não os imprime por data.

Nos outros dois formatos, `fund_cnpj` é nulo.

Em qualquer formato, datas em `YYYY-MM-DD` e números como números positivos
(1234.56, não "1.234,56" nem "1,234.56").
"""


@dataclass(frozen=True)
class ExtractionPrompt:
    system: str
    prompt: str
    temperature: float
    max_tokens: int


def build_brokerage_note_extraction_prompt() -> ExtractionPrompt:
    return ExtractionPrompt(
        system=_SYSTEM,
        prompt=_INSTRUCTIONS,
        # Transcrição: a mesma nota lida duas vezes tem de dar os mesmos números.
        temperature=0.0,
        max_tokens=EXTRACTION_MAX_TOKENS,
    )


STATEMENT_MAX_TOKENS = 8000

_STATEMENT_SYSTEM = (
    'Você transcreve extratos de posição de corretoras. Você copia o que o '
    'documento diz, e nada além disso: não soma, não completa e não corrige. Um '
    'campo que o documento não traz vem nulo.'
)

_STATEMENT_INSTRUCTIONS = """\
Este documento é um extrato de uma corretora — brasileira (Nubank, BTG, XP…) ou
americana (Avenue, Apex Clearing…). Transcreva a posição em custódia que ele
mostra: quais ativos a conta tem, e quantos de cada um.

- `broker_name` e `broker_cnpj`: a corretora que atende a conta (numa
  confirmação americana, a de "Office serving you", não a clearing). Sem CNPJ
  impresso, `broker_cnpj` é nulo.
- `currency`: "BRL" para extrato em reais, "USD" para extrato em dólar.
- `as_of`: a data a que a posição se refere, em `YYYY-MM-DD` — o fim do período
  do extrato, ou a data de referência da posição. Em datas americanas, 09/30/26
  é 2026-09-30.
- `holdings`: uma entrada por ativo em custódia — ações, FIIs, ETFs, BDRs, REITs,
  stocks. Não inclua saldo em dinheiro, sweep, conta remunerada, nem
  movimentações do período: só a posição.
  - `security`: o nome ou a descrição como escritos.
  - `ticker`: o código de negociação sem sufixos (PETR4, XPML11, QQQM). Se o
    extrato só traz o nome, informe o código que o nome descreve; sem certeza,
    deixe nulo.
  - `quantity`: a quantidade em custódia, com todas as casas decimais, como
    número positivo (24.45205, não "24,45205").

Se o extrato separa a mesma posição em mais de uma linha (por exemplo
disponível e bloqueada), transcreva cada linha como aparece: quem soma é a
aplicação.
"""


def build_position_statement_prompt() -> ExtractionPrompt:
    return ExtractionPrompt(
        system=_STATEMENT_SYSTEM,
        prompt=_STATEMENT_INSTRUCTIONS,
        temperature=0.0,
        max_tokens=STATEMENT_MAX_TOKENS,
    )
