from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    UniqueConstraint,
    func,
)

from app.infra.db.base import Base

theoretical_portfolio_table = Table(
    'theoretical_portfolio',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
    Column('name', String(120), nullable=False),
    Column('initial_amount', Float, nullable=False, server_default='10000'),
    Column('contribution_amount', Float, nullable=False, server_default='0'),
    Column('contribution_frequency', String(20), nullable=False, server_default='none'),
    Column('rebalance_frequency', String(20), nullable=False, server_default='none'),
    # A série contra a qual a carteira é lida, além do CDI, que entra sempre.
    # É o mesmo arranjo de `portfolio.custom_category.benchmark_id`.
    Column(
        'benchmark_id',
        Integer,
        ForeignKey('market_data.market_data_series.id', ondelete='SET NULL'),
    ),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column('updated_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint('user_id', 'name', name='uq_theoretical_portfolio_name'),
    Index('ix_theoretical_portfolio_user', 'user_id'),
    schema='lab',
)

theoretical_position_table = Table(
    'theoretical_position',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'theoretical_portfolio_id',
        Integer,
        ForeignKey('lab.theoretical_portfolio.id', ondelete='CASCADE'),
        nullable=False,
    ),
    # Uma linha que o laboratório não sabe precificar não é uma linha: sem o
    # ativo não há série de preço, e manter a linha órfã faria a simulação
    # rodar com uma fatia de caixa que ninguém pediu. Some junto, e quem
    # normaliza os pesos que sobraram é o motor.
    Column('asset_id', Integer, ForeignKey('asset.asset.id', ondelete='CASCADE')),
    Column(
        'series_id',
        Integer,
        ForeignKey('market_data.market_data_series.id', ondelete='CASCADE'),
    ),
    Column(
        'fixed_income_type_id',
        Integer,
        ForeignKey('asset.fixed_income_type.id'),
    ),
    Column('rate', Float),
    Column('label', String(80)),
    Column('weight', Float, nullable=False),
    # Uma linha vira preço por um caminho só, e o banco recusa o meio-termo.
    # Ou ela aponta para um ativo — e o preço é a cotação dele —, ou não aponta
    # e traz uma série, um tipo de rentabilidade, ou os dois: a série sozinha é
    # exposição ao índice (o IBOVESPA, o S&P 500), a série com tipo e taxa é
    # renda fixa sintética (110% do CDI, IPCA + 6%), e o tipo sem série é um
    # prefixado, que não acompanha índice nenhum.
    CheckConstraint(
        '(asset_id IS NOT NULL AND series_id IS NULL AND fixed_income_type_id IS NULL'
        ' AND rate IS NULL)'
        ' OR (asset_id IS NULL AND (series_id IS NOT NULL'
        ' OR fixed_income_type_id IS NOT NULL))',
        name='ck_theoretical_position_source',
    ),
    # Tipo de rentabilidade e taxa andam juntos: um sem o outro não calcula.
    CheckConstraint(
        '(fixed_income_type_id IS NULL) = (rate IS NULL)',
        name='ck_theoretical_position_rate',
    ),
    # O mesmo ativo não entra duas vezes. Postgres trata NULL como distinto, de
    # modo que várias linhas sintéticas convivem — que é o que se quer: dois
    # CDBs de taxas diferentes são duas linhas.
    UniqueConstraint(
        'theoretical_portfolio_id',
        'asset_id',
        name='uq_theoretical_position_asset',
    ),
    Index('ix_theoretical_position_portfolio', 'theoretical_portfolio_id'),
    schema='lab',
)
