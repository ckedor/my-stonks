from sqlalchemy import Boolean, Column, Index, Integer, String, Table

from app.infra.db.base import Base

user_table = Table(
    'user',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('username', String(320), nullable=False),
    Column('email', String(320), nullable=False),
    Column('hashed_password', String(1024), nullable=False),
    Column('is_active', Boolean, nullable=False, default=True),
    Column('is_superuser', Boolean, nullable=False, default=False),
    Column('is_verified', Boolean, nullable=False, default=False),
    Index('ix_user_email', 'email', unique=True),
    Index('ix_user_username', 'username', unique=True),
)
