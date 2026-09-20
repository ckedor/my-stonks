from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.infra.db.base import Base

ai_feature_table = Table(
    'ai_feature',
    Base.metadata,
    Column('id', BigInteger, primary_key=True, autoincrement=True),
    Column('key', Text, nullable=False, unique=True),
    Column('name', Text, nullable=False),
    Column('description', Text, nullable=False, server_default=''),
    Column('output_schema_version', Integer, nullable=False, server_default='1'),
    Column('enabled', Boolean, nullable=False, server_default='true'),
    Column('freshness', Text, nullable=False, server_default='time'),
    # Nulo quando a validade é manual: não existe TTL para uma resposta que só
    # sai por refresh, e guardar um número que ninguém lê é convite a lê-lo.
    Column('ttl_hours', Integer),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column(
        'updated_at',
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    ),
    schema='ai',
)

ai_prompt_version_table = Table(
    'ai_prompt_version',
    Base.metadata,
    Column('id', BigInteger, primary_key=True, autoincrement=True),
    Column(
        'feature_id',
        BigInteger,
        ForeignKey('ai.ai_feature.id', ondelete='CASCADE'),
        nullable=False,
    ),
    Column('version', Integer, nullable=False),
    Column('system', Text, nullable=False, server_default=''),
    Column('template', Text, nullable=False),
    Column('model', Text, nullable=False),
    Column('temperature', Float, nullable=False, server_default='0.2'),
    Column('max_output_tokens', Integer),
    Column('web_search', Boolean, nullable=False, server_default='false'),
    Column('is_active', Boolean, nullable=False, server_default='false'),
    Column('notes', Text, nullable=False, server_default=''),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint('feature_id', 'version', name='uq_ai_prompt_version_number'),
    # Uma ativa por feature, garantida pelo banco. Duas ativas fariam a leitura
    # do artefato depender de qual linha o SELECT devolvesse primeiro.
    Index(
        'uq_ai_prompt_version_active',
        'feature_id',
        unique=True,
        postgresql_where=Column('is_active'),
    ),
    schema='ai',
)

ai_artifact_table = Table(
    'ai_artifact',
    Base.metadata,
    Column('id', UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()),
    Column(
        'feature_id',
        BigInteger,
        ForeignKey('ai.ai_feature.id', ondelete='CASCADE'),
        nullable=False,
    ),
    Column(
        'prompt_version_id',
        BigInteger,
        ForeignKey('ai.ai_prompt_version.id', ondelete='CASCADE'),
        nullable=False,
    ),
    Column('input_hash', Text, nullable=False),
    Column('input', JSONB, nullable=False),
    Column('payload', JSONB, nullable=False),
    Column('schema_version', Integer, nullable=False, server_default='1'),
    Column('model', Text, nullable=False, server_default=''),
    Column('generated_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    # Nulo é "só sai por refresh". A leitura vira uma comparação só:
    # expires_at IS NULL OR expires_at > now().
    Column('expires_at', DateTime(timezone=True)),
    # A versão do prompt faz parte da identidade do artefato, não é metadado
    # sobre ele: ativar uma versão nova aposenta sozinha o que a anterior gerou.
    UniqueConstraint(
        'feature_id', 'prompt_version_id', 'input_hash', name='uq_ai_artifact_identity'
    ),
    schema='ai',
)

ai_run_table = Table(
    'ai_run',
    Base.metadata,
    Column('id', UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()),
    # Nulo de propósito: a extração de carteira recomendada gasta dinheiro e não
    # é uma feature registrada. Sem isso ela não apareceria na tela de custo.
    Column('feature_id', BigInteger, ForeignKey('ai.ai_feature.id', ondelete='SET NULL')),
    Column(
        'prompt_version_id',
        BigInteger,
        ForeignKey('ai.ai_prompt_version.id', ondelete='SET NULL'),
    ),
    Column('label', Text, nullable=False),
    Column('provider', Text, nullable=False, server_default=''),
    Column('model', Text, nullable=False, server_default=''),
    Column('input_tokens', Integer, nullable=False, server_default='0'),
    Column('output_tokens', Integer, nullable=False, server_default='0'),
    Column('cost_usd', Float, nullable=False, server_default='0'),
    Column('latency_ms', Integer, nullable=False, server_default='0'),
    Column('status', Text, nullable=False),
    Column('error', Text),
    Column('trace_id', Text),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    schema='ai',
)

# O teto de gasto soma o custo do dia a cada geração, e a tela de uso agrupa por
# dia. As duas leituras entram por created_at.
Index('ix_ai_run_created_at', ai_run_table.c.created_at.desc())
Index('ix_ai_run_feature', ai_run_table.c.feature_id, ai_run_table.c.created_at.desc())
