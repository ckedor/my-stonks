import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, engine_from_config, pool

# 📁 Caminho da aplicação
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 📦 Configurações
from app.config.settings import settings

# 📥 Tables and imperative mappings
from app.infra.db import bootstrap as _db_bootstrap  # noqa: F401
from app.infra.db.base import Base

# 🎯 Metadata para o autogenerate funcionar
target_metadata = Base.metadata

# 🧠 Alembic config
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 🔗 Define a conexão do banco para o Alembic
config.set_main_option('sqlalchemy.url', settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """Rodar as migrações em modo offline (gera SQL sem conectar no banco)."""
    url = config.get_main_option('sqlalchemy.url')
    context.configure(
        url=url,
        target_metadata=target_metadata,
        include_schemas=True,
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    try:
        test_engine = create_engine(settings.DATABASE_URL)
        test_engine.connect().close()
    except Exception as e:
        print('❌ Falha na conexão com o banco:', str(e))
        raise

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        if connection.dialect.name == 'sqlite':
            for table in target_metadata.tables.values():
                table.schema = None

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            compare_type=True,  # detecta mudanças nos tipos das colunas
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
