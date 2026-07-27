from app.infra.db.models.market_data import AssetPriceHistory
from sqlalchemy import UniqueConstraint


def test_asset_price_history_has_market_data_columns():
    columns = AssetPriceHistory.__table__.columns

    assert {
        'asset_id',
        'currency_id',
        'date',
        'open',
        'close',
        'adjusted_close',
        'high',
        'low',
        'volume',
        'source',
        'updated_at',
    }.issubset(columns.keys())
    assert columns.source.nullable is False
    assert columns.source.server_default is not None
    assert columns.updated_at.nullable is False
    assert columns.updated_at.server_default is not None
    assert columns.updated_at.onupdate is not None


def test_asset_price_history_uses_asset_and_date_index():
    unique_constraints = {
        constraint.name: tuple(column.name for column in constraint.columns)
        for constraint in AssetPriceHistory.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    }

    assert unique_constraints['uq_asset_date'] == ('asset_id', 'date')


def test_asset_price_history_currency_references_currency_table():
    currency_foreign_key = next(iter(AssetPriceHistory.__table__.columns.currency_id.foreign_keys))

    assert currency_foreign_key.target_fullname == 'asset.currency.id'
