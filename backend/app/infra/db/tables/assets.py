from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint

from app.infra.db.base import Base

exchange_table = Table(
    'exchange',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('code', String(10), unique=True, nullable=False),
    Column('name', String(100), nullable=False),
    schema='asset',
)

asset_class_table = Table(
    'asset_class',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False, unique=True),
    schema='asset',
)

asset_type_table = Table(
    'asset_type',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('short_name', String(20), nullable=False, unique=True),
    Column('name', String(100), nullable=False),
    Column('asset_class_id', Integer, ForeignKey('asset.asset_class.id'), nullable=False),
    schema='asset',
)

currency_table = Table(
    'currency',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('code', String(3), unique=True, nullable=False),
    Column('name', String(50), nullable=False),
    schema='asset',
)

#: Uma pessoa jurídica. Não tem coluna de papel de propósito: o papel é a chave
#: estrangeira que aponta para ela — emissora quando é `asset.institution_id`,
#: administradora quando é `fund_registry.administrator_institution_id`. Uma
#: coluna `kind` mentiria para quem é as duas coisas, como um banco que é
#: companhia aberta e administra fundos.
institution_table = Table(
    'institution',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('cnpj', String(14), nullable=False, unique=True),
    #: Nome de exibição: o nome comercial quando existe, senão a razão social.
    Column('name', String(300), nullable=False),
    Column('legal_name', String(300), nullable=False),
    #: Só quem é companhia registrada na CVM tem um. É também o que distingue
    #: uma companhia de uma administradora sem precisar de coluna de papel.
    Column('cvm_code', String(10), nullable=True, unique=True),
    Column('country', String(2), nullable=False, server_default='BR'),
    Column('status', String(40), nullable=True),
    Column('registered_at', Date, nullable=True),
    Column('refreshed_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    schema='asset',
)

asset_table = Table(
    'asset',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('ticker', String(30), nullable=True),
    Column('name', String(200), nullable=False),
    Column('asset_type_id', Integer, ForeignKey('asset.asset_type.id'), nullable=False),
    Column('exchange_id', Integer, ForeignKey('asset.exchange.id'), nullable=True),
    # A URL do logo, e não a imagem: quem serve o arquivo é o provedor, e o
    # navegador já sabe guardá-lo.
    Column('logo_url', String(500), nullable=True),
    #: Quem emitiu o papel, quando não é o próprio ativo. Uma ação aponta para
    #: a companhia; um FII não aponta para nada, porque o fundo é o ativo e o
    #: CNPJ dele vem do cadastro do regulador.
    Column('institution_id', Integer, ForeignKey('asset.institution.id'), nullable=True),
    Column('status', String(20), nullable=False, server_default='active'),
    #: Texto de cadastro, do mantenedor. A IA preenche o rascunho na tela, mas
    #: nada é gravado aqui sem alguém salvar.
    Column('summary', String(300), nullable=True),
    Column('description', Text, nullable=True),
    UniqueConstraint(
        'ticker',
        'exchange_id',
        'asset_type_id',
        name='uq_asset_ticker_exchange_type',
    ),
    schema='asset',
)

event_table = Table(
    'event',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), nullable=False),
    Column('date', Date, nullable=False),
    Column('type', String(50), nullable=False),
    Column('factor', Float, nullable=False),
    schema='asset',
)

stock_table = Table(
    'stock',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('country', String(50), nullable=True),
    Column('sector', String(100), nullable=True),
    Column('industry', String(100), nullable=True),
    #: A espécie do papel — ON, PN, PNA, UNIT. Duas linhas do mesmo emissor com
    #: direitos distintos, e é o que separa ITUB3 de ITUB4 no cadastro.
    Column('share_class', String(10), nullable=True),
    #: O segmento de listagem da B3: Novo Mercado, Nível 2, Básico.
    Column('listing_segment', String(60), nullable=True),
    schema='asset',
)

etf_segment_table = Table(
    'etf_segment',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False, unique=True),
    schema='asset',
)

etf_table = Table(
    'etf',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('segment_id', Integer, ForeignKey('asset.etf_segment.id')),
    # O ETF brasileiro é um fundo registrado na CVM, e o cadastro dele já está
    # no banco: o vínculo entrega CNPJ, administrador, gestor, situação e datas
    # sem coluna nenhuma a mais. Nulo para ETF de fora, que não é registrado
    # aqui. Único porque um fundo do registro é um ativo só.
    #
    # Aponta para o fundo e não para a classe: o CNPJ que o provedor devolve é
    # o do fundo, 539 dos 539 FIIs são achados por ele contra 448 pela classe,
    # e é no fundo que moram administrador, gestor, situação e datas.
    Column(
        'fund_registry_id',
        Integer,
        ForeignKey('asset.fund_registry.id'),
        nullable=True,
        unique=True,
    ),
    schema='asset',
)

fii_type_table = Table(
    'fii_type',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False, unique=True),
    schema='asset',
)

fii_segment_table = Table(
    'fii_segment',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False, unique=True),
    Column('type_id', Integer, ForeignKey('asset.fii_type.id')),
    schema='asset',
)

fii_table = Table(
    'fii',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('segment_id', Integer, ForeignKey('asset.fii_segment.id'), nullable=False),
    # Mesmo vínculo do ETF, pela mesma razão: o cadastro do FII já está no banco.
    Column(
        'fund_registry_id',
        Integer,
        ForeignKey('asset.fund_registry.id'),
        nullable=True,
        unique=True,
    ),
    schema='asset',
)

fixed_income_type_table = Table(
    'fixed_income_type',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False),
    Column('description', String(255)),
    schema='asset',
)

fixed_income_table = Table(
    'fixed_income',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('maturity_date', Date),
    Column('fee', Numeric(8, 5)),
    Column('index_id', Integer, ForeignKey('market_data.market_data_series.id')),
    Column('fixed_income_type_id', Integer, ForeignKey('asset.fixed_income_type.id')),
    schema='asset',
)

fund_registry_table = Table(
    'fund_registry',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('registry_id', BigInteger, nullable=False, unique=True),
    Column('cnpj', String(14), nullable=False, index=True),
    Column('name', String(300), nullable=False),
    Column('kind', String(20), nullable=False),
    Column('status', String(60), nullable=False),
    Column('started_at', Date, nullable=True),
    Column('cancelled_at', Date, nullable=True),
    Column('administrator_name', String(150), nullable=True),
    Column('administrator_cnpj', String(14), nullable=True),
    #: O administrador é sempre um só, então cabe numa chave estrangeira.
    #: O gestor não: 1.040 fundos declaram mais de um e 218 declaram pessoa
    #: física, por isso ele continua como texto.
    Column(
        'administrator_institution_id',
        Integer,
        ForeignKey('asset.institution.id'),
        nullable=True,
        index=True,
    ),
    Column('manager_name', String(500), nullable=True),
    Column('manager_document', String(120), nullable=True),
    Column('refreshed_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    schema='asset',
)

fund_registry_class_table = Table(
    'fund_registry_class',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('registry_id', BigInteger, nullable=False, unique=True),
    Column(
        'fund_registry_id',
        Integer,
        ForeignKey('asset.fund_registry.id'),
        nullable=False,
        index=True,
    ),
    Column('cnpj', String(14), nullable=False, index=True),
    Column('name', String(300), nullable=False),
    Column('class_type', String(80), nullable=True),
    Column('status', String(60), nullable=True),
    Column('classification', String(80), nullable=True),
    Column('anbima_classification', String(120), nullable=True),
    Column('open_ended', Boolean, nullable=True),
    Column('exclusive', Boolean, nullable=True),
    Column('target_investors', String(60), nullable=True),
    Column('long_term_taxation', Boolean, nullable=True),
    Column('custodian_name', String(150), nullable=True),
    Column('auditor_name', String(150), nullable=True),
    Column('equity', Numeric(24, 2), nullable=True),
    Column('equity_date', Date, nullable=True),
    Column('admin_fee', Numeric(15, 6), nullable=True),
    Column('performance_fee', Numeric(27, 12), nullable=True),
    Column('performance_benchmark', String(100), nullable=True),
    Column('minimum_investment', Numeric(17, 2), nullable=True),
    Column('conversion_days', Integer, nullable=True),
    Column('redemption_payment_days', Integer, nullable=True),
    Column('terms_date', Date, nullable=True),
    Column('refreshed_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    schema='asset',
)

fund_registry_subclass_table = Table(
    'fund_registry_subclass',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'fund_registry_class_id',
        Integer,
        ForeignKey('asset.fund_registry_class.id'),
        nullable=False,
    ),
    Column('code', String(30), nullable=False),
    Column('name', String(300), nullable=False),
    Column('status', String(60), nullable=True),
    Column('target_investors', String(60), nullable=True),
    Column('pension', Boolean, nullable=True),
    Column('refreshed_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint('fund_registry_class_id', 'code', name='uq_fund_registry_subclass_code'),
    UniqueConstraint('id', 'fund_registry_class_id', name='uq_fund_registry_subclass_class'),
    schema='asset',
)

fund_share_series_table = Table(
    'fund_share_series',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'fund_registry_class_id',
        Integer,
        ForeignKey('asset.fund_registry_class.id'),
        nullable=False,
        index=True,
    ),
    Column('name', String(100), nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint('id', 'fund_registry_class_id', name='uq_fund_share_series_class'),
    schema='asset',
)

fund_share_series_alias_table = Table(
    'fund_share_series_alias',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('fund_share_series_id', Integer, nullable=False),
    Column('fund_registry_class_id', Integer, nullable=False),
    Column('label', String(100), nullable=False),
    Column('valid_from', Date, nullable=True),
    Column('valid_to', Date, nullable=True),
    Column('confirmed_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    ForeignKeyConstraint(
        ['fund_share_series_id', 'fund_registry_class_id'],
        ['asset.fund_share_series.id', 'asset.fund_share_series.fund_registry_class_id'],
        name='fk_fund_share_series_alias_series_class',
    ),
    CheckConstraint(
        'valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to',
        name='ck_fund_share_series_alias_bounds',
    ),
    Index('ix_fund_share_series_alias_class_label', 'fund_registry_class_id', 'label'),
    # One label cannot mean two things on the same filing date within a class.
    ExcludeConstraint(
        ('fund_registry_class_id', '='),
        ('label', '='),
        (text("daterange(valid_from, valid_to, '[]')"), '&&'),
        using='gist',
        name='ex_fund_share_series_alias_overlap',
    ),
    schema='asset',
)

investment_fund_table = Table(
    'fund',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('legal_id', String(20)),
    Column('anbima_category', String(100)),
    Column(
        'fund_registry_class_id',
        Integer,
        ForeignKey('asset.fund_registry_class.id'),
        nullable=True,
    ),
    Column('fund_registry_subclass_id', Integer, nullable=True),
    Column('fund_share_series_id', Integer, nullable=True),
    Column('selection_version', Integer, nullable=False, server_default='1'),
    ForeignKeyConstraint(
        ['fund_registry_subclass_id', 'fund_registry_class_id'],
        ['asset.fund_registry_subclass.id', 'asset.fund_registry_subclass.fund_registry_class_id'],
        name='fk_fund_registry_subclass_membership',
    ),
    ForeignKeyConstraint(
        ['fund_share_series_id', 'fund_registry_class_id'],
        ['asset.fund_share_series.id', 'asset.fund_share_series.fund_registry_class_id'],
        name='fk_fund_share_series_membership',
    ),
    # A composite foreign key is not checked when one of its columns is null,
    # so a subclass or series without its class would escape the membership
    # check. These make that combination impossible instead.
    CheckConstraint(
        'fund_registry_subclass_id IS NULL OR fund_registry_class_id IS NOT NULL',
        name='ck_fund_subclass_requires_class',
    ),
    CheckConstraint(
        'fund_share_series_id IS NULL OR fund_registry_class_id IS NOT NULL',
        name='ck_fund_series_requires_class',
    ),
    # The priced unit is registered once. Distinct subclasses or series of one
    # class coexist; nulls are folded so that "no subclass" is itself a value.
    Index(
        'uq_fund_priced_unit',
        'fund_registry_class_id',
        func.coalesce(text('fund_registry_subclass_id'), 0),
        func.coalesce(text('fund_share_series_id'), 0),
        unique=True,
        postgresql_where=text('fund_registry_class_id IS NOT NULL'),
    ),
    schema='asset',
)

treasury_bond_type_table = Table(
    'treasury_bond_type',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('code', String(20), nullable=False, unique=True),
    Column('name', String(100), nullable=False, unique=True),
    Column('description', String(255), nullable=True),
    schema='asset',
)

treasury_bond_table = Table(
    'treasury_bond',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), nullable=False),
    Column('maturity_date', Date),
    Column('fee', Numeric(8, 5), nullable=True),
    Column('type_id', Integer, ForeignKey('asset.treasury_bond_type.id'), nullable=False),
    schema='asset',
)

broker_table = Table(
    'broker',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(100), nullable=False),
    Column('cnpj', String(18), unique=True, nullable=True),
    Column('currency_id', Integer, ForeignKey('asset.currency.id'), nullable=False),
    schema='portfolio',
)
