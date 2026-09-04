"""Apagar os ETFs que a sincronização cadastrou uma segunda vez como FII

Revision ID: d8f0b2c4e6a9
Revises: c7e9a1b3d5f7
Create Date: 2026-08-30

O mesmo balaio que duplicou os fundos de investimento duplicou os ETFs: o
screener da B3 responde por `type=fund` com fundo imobiliário, ETF, Fiagro e
FI-Infra na mesma lista, e a sincronização cadastrava todos como FII. BOVA11,
IVVB11, ACWI11 e mais 157 tickers passaram a existir duas vezes — uma como ETF,
que é o que eles são, e outra como FII.

Este par se desfaz ao contrário do que ``c7e9a1b3d5f7`` fez com os fundos. Lá a
linha antiga estava com o tipo errado e precisava mudar de tipo; aqui a linha
de ETF já está certa e é ela que carrega tudo — 5.089 cotações e 51 transações
contra zero do lado FII, que nasceu vazio. Então não há retipagem: a falsa é
apagada e acabou.

A regra por trás das duas é a mesma, e é a única que importa numa fusão:
**fica quem tem história**. O `asset_id` da linha antiga está escrito em meia
dúzia de tabelas, e eleger a linha vazia como sobrevivente obrigaria a
reescrever todas elas para ganhar nada.

Fica de fora, de propósito, o par entre ETF e fundo de investimento: são 23
tickers em que **nenhum dos dois lados tem cotação ou transação**, e sem
histórico não há como o banco dizer qual dos dois é o papel de verdade.
Escolher no palpite classificaria errado 23 ativos em silêncio, que é pior do
que deixá-los duplicados e visíveis.
"""

import sqlalchemy as sa
from alembic import op

revision = 'd8f0b2c4e6a9'
down_revision = 'c7e9a1b3d5f7'
branch_labels = None
depends_on = None

ASSET_TYPE_ETF = 1
ASSET_TYPE_FII = 2


def upgrade() -> None:
    connection = op.get_bind()

    pairs = connection.execute(
        sa.text("""
            SELECT etf.id AS keep_id, falso.id AS drop_id
            FROM asset.asset AS etf
            JOIN asset.asset AS falso ON falso.ticker = etf.ticker
            WHERE etf.asset_type_id = :etf_type AND falso.asset_type_id = :fii
        """),
        {'etf_type': ASSET_TYPE_ETF, 'fii': ASSET_TYPE_FII},
    ).all()
    if not pairs:
        return

    keep_ids = [pair.keep_id for pair in pairs]
    drop_ids = [pair.drop_id for pair in pairs]

    # A visita é a única coisa que a linha falsa chega a acumular — basta abrir
    # a página dela uma vez. A contagem é somada na que fica, porque é ela que a
    # tela de mais acessados vai listar. Duas linhas do mesmo usuário para o
    # mesmo ativo violariam a unicidade, e por isso isto é soma e não cópia.
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

    # A subclasse imobiliária vai junto da linha que a carregava: ela não existe
    # para ETF, e a chave estrangeira impediria o apagão de qualquer jeito.
    connection.execute(
        sa.text('DELETE FROM asset.fii WHERE asset_id = ANY(:drop_ids)'),
        {'drop_ids': drop_ids},
    )
    connection.execute(
        sa.text('DELETE FROM asset.asset WHERE id = ANY(:drop_ids)'),
        {'drop_ids': drop_ids},
    )


def downgrade() -> None:
    """Não há volta: recriar as duplicatas seria devolver o defeito."""
    raise NotImplementedError(
        'A fusão de ativos duplicados não é reversível: restaure de um backup.'
    )
