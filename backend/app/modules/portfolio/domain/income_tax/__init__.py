"""Apuração do imposto de renda sobre investimentos, sem banco nem HTTP.

A unidade é o contribuinte — um usuário, todas as carteiras dele —, e o fluxo é
um só: fatos (operações e eventos) → custo e resultado de cada venda → apuração
mensal por regime → obrigações de DARF. As abas da tela projetam o mesmo
resultado; nenhuma recalcula por conta própria.

Dinheiro é `Decimal` do começo ao fim. O custo médio não é arredondado entre
uma compra e outra; o centavo aparece só no imposto e no que a tela mostra.
"""
