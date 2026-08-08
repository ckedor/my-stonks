from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Index, Integer
from sqlalchemy import Table, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.infra.db.base import Base

ai_feature_table = Table(
    'ai_feature',
    Base.metadata,
    Column('id', BigInteger, primary_key=True, autoincrement=True),
    Column('key', Text, nullable=False, unique=True),
    Column('default_ttl_hours', Integer, nullable=False, server_default='168'),
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

ai_artifact_table = Table(
    'ai_artifact',
    Base.metadata,
    Column('id', UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()),
    Column(
        'feature_id',
        BigInteger,
        ForeignKey('ai.ai_feature.id', ondelete='RESTRICT'),
        nullable=False,
    ),
    Column('summary', Text, nullable=False),
    Column('payload', JSONB, nullable=False),
    Column('input_hash', Text, nullable=True),
    Column('model', Text, nullable=True),
    Column('generated_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column('expires_at', DateTime(timezone=True), nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    Index('idx_ai_artifact_expires', 'expires_at'),
    Index(
        'uq_ai_artifact_dedupe',
        'feature_id',
        'input_hash',
        unique=True,
        postgresql_where=Column('input_hash').isnot(None),
    ),
    schema='ai',
)

Index(
    'idx_ai_artifact_lookup',
    ai_artifact_table.c.feature_id,
    ai_artifact_table.c.generated_at.desc(),
)
