from app.infra.db.base import Base
from sqlalchemy import BigInteger, Column, DateTime, Integer, Text, func


class AIFeature(Base):
    __tablename__ = 'ai_feature'
    __table_args__ = {'schema': 'ai'}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    key = Column(Text, nullable=False, unique=True)
    default_ttl_hours = Column(Integer, nullable=False, server_default='168')

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self):
        return f'<AIFeature {self.key}>'
