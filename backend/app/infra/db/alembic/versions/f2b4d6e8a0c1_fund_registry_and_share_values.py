"""Cadastro de fundos da CVM, séries de cota e cobertura dos arquivos de cota

Revision ID: f2b4d6e8a0c1
Revises: e1a3c5b7d9f2
Create Date: 2026-09-17

O cadastro mora no banco e não num cache, porque um ativo aponta para ele e um
cache que expira não pode ser referenciado. Linha do cadastro não é ativo: o
ativo nasce só quando alguém escolhe a unidade precificada — a classe, a
subclasse, ou a série de cotas de um FIDC.

A série tem identidade interna porque o rótulo com que o FIDC a informa muda
("Série 1" virou "Subclasse 1"). Os rótulos confirmados ficam em
`fund_share_series_alias`, com as datas em que valeram; a restrição de exclusão
impede que um mesmo rótulo signifique duas coisas na mesma data dentro da
classe, e precisa de `btree_gist` para comparar igualdade dentro do índice gist.

`asset.fund` ganha o vínculo com a unidade precificada. As chaves compostas
garantem que subclasse e série pertencem à classe escolhida, e os CHECKs fecham
o buraco de uma chave composta com uma coluna nula, que o Postgres não confere.
A unicidade da unidade dobra os nulos em zero porque o Postgres 14 não tem
`NULLS NOT DISTINCT`.

`market_data.source_file` guarda validadores (ETag, Last-Modified) e a versão
do conteúdo do último corpo processado — nunca o arquivo. Validador não é
cobertura: o que diz que um ativo já recebeu um arquivo naquela versão é
`fund_share_value_coverage`, gravada na mesma transação das cotas.

`ingestion_checkpoint` existe porque o histórico de execuções dura dois dias, e
a varredura semanal de revisões precisa saber quando terminou pela última vez.

Os códigos ANBIMA de `asset.fund` saem numa migração própria, depois que o
formulário parar de usá-los.
"""

from alembic import op

revision = 'f2b4d6e8a0c1'
down_revision = 'e1a3c5b7d9f2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS btree_gist;')

    op.execute(
        """
        CREATE TABLE asset.fund_registry (
            id SERIAL PRIMARY KEY,
            registry_id BIGINT NOT NULL UNIQUE,
            cnpj VARCHAR(14) NOT NULL,
            name VARCHAR(300) NOT NULL,
            kind VARCHAR(20) NOT NULL,
            status VARCHAR(60) NOT NULL,
            started_at DATE,
            cancelled_at DATE,
            administrator_name VARCHAR(150),
            administrator_cnpj VARCHAR(14),
            manager_name VARCHAR(500),
            manager_document VARCHAR(120),
            refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    op.execute('CREATE INDEX ix_asset_fund_registry_cnpj ON asset.fund_registry (cnpj);')

    op.execute(
        """
        CREATE TABLE asset.fund_registry_class (
            id SERIAL PRIMARY KEY,
            registry_id BIGINT NOT NULL UNIQUE,
            fund_registry_id INTEGER NOT NULL REFERENCES asset.fund_registry(id),
            cnpj VARCHAR(14) NOT NULL,
            name VARCHAR(300) NOT NULL,
            class_type VARCHAR(80),
            status VARCHAR(60),
            classification VARCHAR(80),
            anbima_classification VARCHAR(120),
            open_ended BOOLEAN,
            exclusive BOOLEAN,
            target_investors VARCHAR(60),
            long_term_taxation BOOLEAN,
            custodian_name VARCHAR(150),
            auditor_name VARCHAR(150),
            equity NUMERIC(24, 2),
            equity_date DATE,
            admin_fee NUMERIC(15, 6),
            performance_fee NUMERIC(27, 12),
            performance_benchmark VARCHAR(100),
            minimum_investment NUMERIC(17, 2),
            conversion_days INTEGER,
            redemption_payment_days INTEGER,
            terms_date DATE,
            refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        'CREATE INDEX ix_asset_fund_registry_class_fund_registry_id '
        'ON asset.fund_registry_class (fund_registry_id);'
    )
    op.execute(
        'CREATE INDEX ix_asset_fund_registry_class_cnpj ON asset.fund_registry_class (cnpj);'
    )

    op.execute(
        """
        CREATE TABLE asset.fund_registry_subclass (
            id SERIAL PRIMARY KEY,
            fund_registry_class_id INTEGER NOT NULL REFERENCES asset.fund_registry_class(id),
            code VARCHAR(30) NOT NULL,
            name VARCHAR(300) NOT NULL,
            status VARCHAR(60),
            target_investors VARCHAR(60),
            pension BOOLEAN,
            refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_fund_registry_subclass_code UNIQUE (fund_registry_class_id, code),
            CONSTRAINT uq_fund_registry_subclass_class UNIQUE (id, fund_registry_class_id)
        );
        """
    )

    op.execute(
        """
        CREATE TABLE asset.fund_share_series (
            id SERIAL PRIMARY KEY,
            fund_registry_class_id INTEGER NOT NULL REFERENCES asset.fund_registry_class(id),
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_fund_share_series_class UNIQUE (id, fund_registry_class_id)
        );
        """
    )
    op.execute(
        'CREATE INDEX ix_asset_fund_share_series_fund_registry_class_id '
        'ON asset.fund_share_series (fund_registry_class_id);'
    )

    op.execute(
        """
        CREATE TABLE asset.fund_share_series_alias (
            id SERIAL PRIMARY KEY,
            fund_share_series_id INTEGER NOT NULL,
            fund_registry_class_id INTEGER NOT NULL,
            label VARCHAR(100) NOT NULL,
            valid_from DATE,
            valid_to DATE,
            confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_fund_share_series_alias_series_class
                FOREIGN KEY (fund_share_series_id, fund_registry_class_id)
                REFERENCES asset.fund_share_series (id, fund_registry_class_id),
            CONSTRAINT ck_fund_share_series_alias_bounds
                CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to),
            CONSTRAINT ex_fund_share_series_alias_overlap EXCLUDE USING gist (
                fund_registry_class_id WITH =,
                label WITH =,
                daterange(valid_from, valid_to, '[]') WITH &&
            )
        );
        """
    )
    op.execute(
        'CREATE INDEX ix_fund_share_series_alias_class_label '
        'ON asset.fund_share_series_alias (fund_registry_class_id, label);'
    )

    op.execute(
        """
        ALTER TABLE asset.fund
            ADD COLUMN fund_registry_class_id INTEGER
                REFERENCES asset.fund_registry_class(id),
            ADD COLUMN fund_registry_subclass_id INTEGER,
            ADD COLUMN fund_share_series_id INTEGER,
            ADD COLUMN selection_version INTEGER NOT NULL DEFAULT 1,
            ADD CONSTRAINT fk_fund_registry_subclass_membership
                FOREIGN KEY (fund_registry_subclass_id, fund_registry_class_id)
                REFERENCES asset.fund_registry_subclass (id, fund_registry_class_id),
            ADD CONSTRAINT fk_fund_share_series_membership
                FOREIGN KEY (fund_share_series_id, fund_registry_class_id)
                REFERENCES asset.fund_share_series (id, fund_registry_class_id),
            ADD CONSTRAINT ck_fund_subclass_requires_class
                CHECK (fund_registry_subclass_id IS NULL OR fund_registry_class_id IS NOT NULL),
            ADD CONSTRAINT ck_fund_series_requires_class
                CHECK (fund_share_series_id IS NULL OR fund_registry_class_id IS NOT NULL);
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_fund_priced_unit ON asset.fund (
            fund_registry_class_id,
            coalesce(fund_registry_subclass_id, 0),
            coalesce(fund_share_series_id, 0)
        ) WHERE fund_registry_class_id IS NOT NULL;
        """
    )

    op.execute(
        """
        CREATE TABLE market_data.source_file (
            id SERIAL PRIMARY KEY,
            dataset VARCHAR(40) NOT NULL,
            period VARCHAR(10) NOT NULL,
            etag VARCHAR(80),
            last_modified TIMESTAMPTZ,
            size_bytes BIGINT,
            content_version VARCHAR(64),
            fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_source_file_dataset_period UNIQUE (dataset, period)
        );
        """
    )
    op.execute(
        """
        CREATE TABLE market_data.fund_share_value_coverage (
            id SERIAL PRIMARY KEY,
            source_file_id INTEGER NOT NULL
                REFERENCES market_data.source_file(id) ON DELETE CASCADE,
            asset_id INTEGER NOT NULL REFERENCES asset.asset(id) ON DELETE CASCADE,
            content_version VARCHAR(64) NOT NULL,
            selection_version INTEGER NOT NULL,
            covered_from DATE NOT NULL,
            covered_to DATE NOT NULL,
            matched_rows INTEGER NOT NULL DEFAULT 0,
            processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_fund_share_value_coverage_application UNIQUE (
                source_file_id, asset_id, content_version, selection_version,
                covered_from, covered_to
            )
        );
        """
    )
    op.execute(
        'CREATE INDEX ix_market_data_fund_share_value_coverage_asset_id '
        'ON market_data.fund_share_value_coverage (asset_id);'
    )
    op.execute(
        """
        CREATE TABLE market_data.ingestion_checkpoint (
            name VARCHAR(60) PRIMARY KEY,
            succeeded_at TIMESTAMPTZ NOT NULL
        );
        """
    )


def downgrade() -> None:
    op.execute('DROP TABLE market_data.ingestion_checkpoint;')
    op.execute('DROP TABLE market_data.fund_share_value_coverage;')
    op.execute('DROP TABLE market_data.source_file;')
    op.execute('DROP INDEX asset.uq_fund_priced_unit;')
    op.execute(
        """
        ALTER TABLE asset.fund
            DROP CONSTRAINT ck_fund_series_requires_class,
            DROP CONSTRAINT ck_fund_subclass_requires_class,
            DROP CONSTRAINT fk_fund_share_series_membership,
            DROP CONSTRAINT fk_fund_registry_subclass_membership,
            DROP COLUMN selection_version,
            DROP COLUMN fund_share_series_id,
            DROP COLUMN fund_registry_subclass_id,
            DROP COLUMN fund_registry_class_id;
        """
    )
    op.execute('DROP TABLE asset.fund_share_series_alias;')
    op.execute('DROP TABLE asset.fund_share_series;')
    op.execute('DROP TABLE asset.fund_registry_subclass;')
    op.execute('DROP TABLE asset.fund_registry_class;')
    op.execute('DROP TABLE asset.fund_registry;')
