"""The priced-unit rules hold in the database, not only in the service.

Each case writes the forbidden row directly, so a constraint that silently
stopped matching (a renamed column, a dropped index) fails here.
"""

from datetime import date

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError


async def _scalar(db, sql, **params):
    return (await db.execute(text(sql), params)).scalar_one()


async def _class(db, *, registry_id: int, cnpj: str) -> int:
    fund_id = await _scalar(
        db,
        'INSERT INTO asset.fund_registry (registry_id, cnpj, name, kind, status) '
        "VALUES (:registry_id, :cnpj, 'Fundo', 'FIDC', 'Em Funcionamento Normal') RETURNING id",
        registry_id=registry_id,
        cnpj=cnpj,
    )
    return await _scalar(
        db,
        'INSERT INTO asset.fund_registry_class (registry_id, fund_registry_id, cnpj, name) '
        "VALUES (:registry_id, :fund_id, :cnpj, 'Classe') RETURNING id",
        registry_id=registry_id,
        fund_id=fund_id,
        cnpj=cnpj,
    )


async def _series(db, class_id: int, name: str = 'Senior') -> int:
    return await _scalar(
        db,
        'INSERT INTO asset.fund_share_series (fund_registry_class_id, name) '
        'VALUES (:class_id, :name) RETURNING id',
        class_id=class_id,
        name=name,
    )


async def _subclass(db, class_id: int, code: str) -> int:
    return await _scalar(
        db,
        'INSERT INTO asset.fund_registry_subclass (fund_registry_class_id, code, name) '
        "VALUES (:class_id, :code, 'Subclasse') RETURNING id",
        class_id=class_id,
        code=code,
    )


async def _fund(db, factory, **columns) -> int:
    asset_id = await factory.asset(ticker=None, name='Fundo')
    names = ', '.join(['asset_id', *columns])
    values = ', '.join([':asset_id', *(f':{name}' for name in columns)])
    await db.execute(
        text(f'INSERT INTO asset.fund ({names}) VALUES ({values})'),
        {'asset_id': asset_id, **columns},
    )
    return asset_id


async def _rejects(db, coroutine):
    savepoint = await db.begin_nested()
    with pytest.raises(IntegrityError):
        await coroutine
    await savepoint.rollback()


async def test_distinct_series_and_subclasses_coexist_but_a_unit_is_registered_once(db, factory):
    class_id = await _class(db, registry_id=1, cnpj='55139905000139')
    senior = await _series(db, class_id, 'Senior')
    mezzanine = await _series(db, class_id, 'Mezanino')
    subclass = await _subclass(db, class_id, 'ABC1')

    await _fund(db, factory, fund_registry_class_id=class_id, fund_share_series_id=senior)
    await _fund(db, factory, fund_registry_class_id=class_id, fund_share_series_id=mezzanine)
    await _fund(db, factory, fund_registry_class_id=class_id, fund_registry_subclass_id=subclass)
    await _fund(db, factory, fund_registry_class_id=class_id)

    await _rejects(
        db, _fund(db, factory, fund_registry_class_id=class_id, fund_share_series_id=senior)
    )
    await _rejects(db, _fund(db, factory, fund_registry_class_id=class_id))


async def test_manual_funds_without_a_registry_link_are_not_bound_by_unit_uniqueness(db, factory):
    await _fund(db, factory, legal_id='55139905000139')
    await _fund(db, factory, legal_id='55139905000139')


async def test_a_subclass_or_series_must_belong_to_the_chosen_class(db, factory):
    class_id = await _class(db, registry_id=1, cnpj='11111111000111')
    other_class_id = await _class(db, registry_id=2, cnpj='22222222000122')
    foreign_series = await _series(db, other_class_id)
    foreign_subclass = await _subclass(db, other_class_id, 'XYZ9')

    await _rejects(
        db, _fund(db, factory, fund_registry_class_id=class_id, fund_share_series_id=foreign_series)
    )
    await _rejects(
        db,
        _fund(
            db, factory, fund_registry_class_id=class_id, fund_registry_subclass_id=foreign_subclass
        ),
    )
    # Without the class, a composite key would not be checked at all.
    await _rejects(db, _fund(db, factory, fund_share_series_id=foreign_series))
    await _rejects(db, _fund(db, factory, fund_registry_subclass_id=foreign_subclass))


async def test_one_label_cannot_mean_two_series_on_the_same_date(db):
    class_id = await _class(db, registry_id=1, cnpj='55139905000139')
    first = await _series(db, class_id, 'Senior 1')
    second = await _series(db, class_id, 'Senior 2')

    async def alias(series_id, label, valid_from, valid_to):
        await db.execute(
            text(
                'INSERT INTO asset.fund_share_series_alias '
                '(fund_share_series_id, fund_registry_class_id, label, valid_from, valid_to) '
                'VALUES (:series_id, :class_id, :label, :valid_from, :valid_to)'
            ),
            {
                'series_id': series_id,
                'class_id': class_id,
                'label': label,
                'valid_from': valid_from,
                'valid_to': valid_to,
            },
        )

    may, june = date(2026, 5, 31), date(2026, 6, 1)
    await alias(first, 'subclasse senior serie 1', None, may)
    await alias(second, 'subclasse senior serie 1', june, None)
    await _rejects(db, alias(second, 'subclasse senior serie 1', may, may))
    # Inverted bounds would make an alias that applies to no date at all.
    await _rejects(db, alias(first, 'subclasse senior subclasse 1', june, may))
