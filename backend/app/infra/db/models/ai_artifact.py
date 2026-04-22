from app.infra.db.base import Base
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship


class AIArtifact(Base):
    __tablename__ = 'ai_artifact'
    __table_args__ = (
        Index('idx_ai_artifact_lookup', 'feature_id', 'generated_at'),
        Index('idx_ai_artifact_expires', 'expires_at'),
        Index(
            'uq_ai_artifact_dedupe',
            'feature_id',
            'input_hash',
            unique=True,
            postgresql_where=Column('input_hash').isnot(None),
        ),
        {'schema': 'ai'},
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    feature_id = Column(
        BigInteger,
        ForeignKey('ai.ai_feature.id', ondelete='RESTRICT'),
        nullable=False,
    )

    summary = Column(Text, nullable=False)
    payload = Column(JSONB, nullable=False)
    input_hash = Column(Text, nullable=True)
    model = Column(Text, nullable=True)

    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    feature = relationship('AIFeature', lazy='joined')

    def __repr__(self):
        return f'<AIArtifact {self.id} feature_id={self.feature_id}>'
