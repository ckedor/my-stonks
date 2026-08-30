"""Fundir no ativo original os fundos que a sincronização duplicou como FI

Revision ID: c7e9a1b3d5f7
Revises: e5a7c9b1d3f6
Create Date: 2026-08-30

O screener da B3 responde por fundo listado com um `type=fund` só, e nesse
balaio cabem o fundo imobiliário, o Fiagro e o FI-Infra. A sincronização de
catálogo lia dali e cadastrava os três como FII, então a tela de fundos — que
busca por tipo FI — não encontrava nenhum deles. Corrigida a fonte, a
sincronização passou a cadastrar os mesmos papéis pela rota certa, e o
resultado foi um ticker em duas linhas: a antiga, tipada como FII, e a nova,
tipada como FI.

A fusão preserva a linha antiga e descarta a nova, e não o contrário. É a
antiga que carrega transação, cotação, provento e posição — o `asset_id` dela
está escrito em meia dúzia de tabelas, e trocar o id sobrevivente seria
reescrever todas elas para ganhar nada. O que a linha nova tem de próprio é o
tipo correto, e tipo é uma coluna: ela se move.

Nada aqui pergunta ao provedor. O par a fundir é o ticker que existe nos dois
tipos ao mesmo tempo, e isso o banco responde sozinho — uma migração que
consultasse a brapi daria um resultado diferente a cada execução. Fundo que
existe só como FI é fundo que a rota nova trouxe e o balaio nunca teve: não
tem par, não entra na fusão e fica como está.
"""

import sqlalchemy as sa
from alembic import op

revision = 'c7e9a1b3d5f7'
down_revision = 'e5a7c9b1d3f6'
branch_labels = None
depends_on = None

ASSET_TYPE_FII = 2
ASSET_TYPE_FI = 7


def upgrade() -> None:
    connection = op.get_bind()

    # O par é lido inteiro antes de qualquer escrita: a primeira delas desfaz
    # justamente o critério que o define.
    pairs = connection.execute(
        sa.text("""
            SELECT antigo.id AS keep_id, novo.id AS drop_id
            FROM asset.asset AS antigo
            JOIN asset.asset AS novo ON novo.ticker = antigo.ticker
            WHERE antigo.asset_type_id = :fii AND novo.asset_type_id = :fi
        """),
        {'fii': ASSET_TYPE_FII, 'fi': ASSET_TYPE_FI},
    ).all()
    if not pairs:
        return

    keep_ids = [pair.keep_id for pair in pairs]
    drop_ids = [pair.drop_id for pair in pairs]

    # A visita é a única coisa que a linha nova chega a acumular — basta abrir
    # a página dela uma vez. A contagem é somada na linha que fica, porque é
    # ela que a tela de mais acessados vai listar; o resto some no cascade do
    # apagão. Duas linhas do mesmo usuário para o mesmo ativo violariam a
    # unicidade, e é por isso que isto é uma soma e não uma cópia.
    connection.execute(
        sa.text("""
            UPDATE market_data.asset_visit AS destino
            SET visit_count = destino.visit_count + origem.visit_count,
                last_visited_at = GREATEST(
                    destino.last_visited_at, origem.last_visited_at
                )
            FROM market_data.asset_visit AS origem
            JOIN UNNEST(:keep_ids, :drop_ids) AS pares(keep_id, drop_id)
              ON origem.asset_id = pares.drop_id
            WHERE destino.asset_id = pares.keep_id
              AND destino.user_id = origem.user_id
        """),
        {'keep_ids': keep_ids, 'drop_ids': drop_ids},
    )
    connection.execute(
        sa.text("""
            UPDATE market_data.asset_visit AS orfa
            SET asset_id = pares.keep_id
            FROM UNNEST(:keep_ids, :drop_ids) AS pares(keep_id, drop_id)
            WHERE orfa.asset_id = pares.drop_id
              AND NOT EXISTS (
                  SELECT 1 FROM market_data.asset_visit AS destino
                  WHERE destino.asset_id = pares.keep_id
                    AND destino.user_id = orfa.user_id
              )
        """),
        {'keep_ids': keep_ids, 'drop_ids': drop_ids},
    )

    connection.execute(
        sa.text('DELETE FROM asset.asset WHERE id = ANY(:drop_ids)'),
        {'drop_ids': drop_ids},
    )

    # A subclasse imobiliária sai antes de o tipo mudar, enquanto ainda dá para
    # reconhecer quem ela era. Ela não existe para FI.
    connection.execute(
        sa.text('DELETE FROM asset.fii WHERE asset_id = ANY(:keep_ids)'),
        {'keep_ids': keep_ids},
    )
    connection.execute(
        sa.text('UPDATE asset.asset SET asset_type_id = :fi WHERE id = ANY(:keep_ids)'),
        {'fi': ASSET_TYPE_FI, 'keep_ids': keep_ids},
    )


def downgrade() -> None:
    """Não há volta, e fingir que há seria pior do que dizer isto.

    O `upgrade` apaga a linha duplicada, e o que identificava o par morre com
    ela: depois da fusão nada no banco distingue um fundo que sempre foi FI de
    um que acabou de deixar de ser FII. Recriar as duplicatas devolveria o
    defeito, e retipar todo FI de volta para FII levaria junto os que nunca
    foram — nas duas hipóteses o banco fica pior do que está.
    """
    raise NotImplementedError(
        'A fusão de ativos duplicados não é reversível: restaure de um backup.'
    )
