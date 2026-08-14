import math
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, TypeVar

import pandas as pd
from sqlalchemy import Date, DateTime, asc, desc, inspect, select, text
from sqlalchemy import delete as sqlalchemy_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.declarative import DeclarativeMeta
from sqlalchemy.orm import selectinload

ModelType = TypeVar('ModelType')

#: Rows sent per ``upsert_bulk`` statement. Normalizing rows and binding them
#: for the driver each allocate a copy per row, so writing a full quote history
#: as a single statement holds several copies of the whole series at once. The
#: chunks share one transaction, so the write stays all-or-nothing.
UPSERT_CHUNK_SIZE = 1000


class SQLAlchemyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def _apply_filters(stmt, model, by: dict):
        for key, value in by.items():
            if '__' in key:
                field, op = key.split('__', 1)
                col = getattr(model, field)
                if op == 'ilike':
                    stmt = stmt.where(col.ilike(value))
                elif op == 'like':
                    stmt = stmt.where(col.like(value))
                elif op == 'gte':
                    stmt = stmt.where(col >= value)
                elif op == 'lte':
                    stmt = stmt.where(col <= value)
                elif op == 'gt':
                    stmt = stmt.where(col > value)
                elif op == 'lt':
                    stmt = stmt.where(col < value)
                elif op == 'in':
                    stmt = stmt.where(col.in_(value))
                else:
                    raise ValueError(f'Unsupported filter operation: {op}')
            else:
                stmt = stmt.where(getattr(model, key) == value)
        return stmt

    @staticmethod
    def _normalize_datetime_columns(df: pd.DataFrame, model: ModelType) -> pd.DataFrame:
        for column in model.__table__.columns:
            if isinstance(column.type, DateTime | Date) and column.name in df.columns:
                df[column.name] = pd.to_datetime(df[column.name])
        return df

    async def get(  # noqa: PLR0913, PLR0912
        self,
        model: ModelType,
        id: int | None = None,
        by: dict | None = None,
        order_by: str | None = None,
        first: bool = False,
        as_df: bool = False,
        relations: list[str] | None = None,
    ) -> Any:
        if id is not None:
            stmt = select(model)
            if relations:
                for relation in relations:
                    stmt = stmt.options(selectinload(getattr(model, relation)))

            pk_col = inspect(model).primary_key[0]
            stmt = stmt.where(pk_col == id)

            result = await self.session.execute(stmt)
            instance = result.scalar_one_or_none()

            if as_df:
                if instance:
                    df = pd.json_normalize([self._serialize_instance(instance)])
                    return self._normalize_datetime_columns(df, model)
                return pd.DataFrame()

            return instance

        stmt = select(model)

        if relations:
            for relation in relations:
                stmt = stmt.options(selectinload(getattr(model, relation)))

        if by:
            stmt = self._apply_filters(stmt, model, by)

        if order_by:
            if order_by.endswith(' desc'):
                field = order_by.replace(' desc', '')
                stmt = stmt.order_by(desc(getattr(model, field)))
            elif order_by.endswith(' asc'):
                field = order_by.replace(' asc', '')
                stmt = stmt.order_by(asc(getattr(model, field)))
            else:
                stmt = stmt.order_by(getattr(model, order_by))

        result = await self.session.execute(stmt)
        scalars = result.scalars()

        if as_df:
            items = scalars.all()
            data = [
                {col.name: getattr(item, col.name) for col in model.__table__.columns}
                for item in items
            ]
            df = pd.DataFrame(data)
            return self._normalize_datetime_columns(df, model)

        return scalars.first() if first else scalars.all()

    def _serialize_instance(self, instance: Any) -> dict:
        def serialize_value(value: Any) -> Any:
            if isinstance(value, datetime):
                return value.isoformat()
            elif isinstance(value, Decimal):
                return float(value)
            elif isinstance(value, Enum):
                return value.value
            elif isinstance(value, DeclarativeMeta) or hasattr(value, '__table__'):
                return self._serialize_instance(value)
            elif value is None:
                return {}
            else:
                return value

        data = {}
        for key, value in vars(instance).items():
            if key.startswith('_'):
                continue

            serialized = serialize_value(value)

            if isinstance(serialized, dict) and hasattr(value, '__table__'):
                if serialized:
                    for subkey, subval in serialized.items():
                        data[f'{key}.{subkey}'] = subval
            else:
                data[key] = serialized

        return data

    async def get_all(
        self,
        model: ModelType,
        relations: list[str] | None = None,
        as_df: bool = False,
    ) -> list[Any] | pd.DataFrame:
        stmt = select(model)

        if relations:
            for relation in relations:
                stmt = stmt.options(selectinload(getattr(model, relation)))

        result = await self.session.execute(stmt)
        items = result.scalars().all()

        if as_df:
            serialized = [self._serialize_instance(item) for item in items]
            df = pd.json_normalize(serialized)
            return self._normalize_datetime_columns(df, model)

        return items

    @staticmethod
    def _detach_unset_relationships(instance: Any, provided: set[str]) -> None:
        """Drop relationship attributes that only hold their dataclass default.

        Only for instances that were never persisted: on one loaded from the
        database a None relationship is an answer, not an absence, and removing
        it would trigger a reload.
        """
        state = inspect(instance)
        if not state.transient:
            return
        for relationship in state.mapper.relationships:
            key = relationship.key
            if key not in provided and instance.__dict__.get(key) is None:
                del instance.__dict__[key]

    @classmethod
    def _build(cls, model: ModelType, data: dict) -> ModelType:
        """Construct an entity from a dict without losing the foreign keys in it.

        Every persisted entity is a dataclass, so its `__init__` assigns *every*
        field, relationships included, and an unmentioned one lands as None.
        SQLAlchemy cannot tell that None apart from a deliberate "no related
        row", and at flush time the relationship wins over the column beneath
        it: `Portfolio(name=..., user_id=7)` also carries `user=None`, and the
        INSERT writes NULL into `user_id`.

        Thirty-nine relationships across the domain sit over a foreign key like
        that. Where the column is NOT NULL the write fails outright — creating a
        portfolio or a broker could not succeed — and where it is nullable the
        foreign key is silently dropped.

        Dropping the attribute from the instance state leaves it simply unset,
        which is what the caller meant. A relationship named in `data` is left
        alone, so passing `user=None` on purpose still clears it.
        """
        instance = model(**data)
        cls._detach_unset_relationships(instance, set(data))
        return instance

    async def create(self, model: ModelType, data: dict | list[dict | ModelType]) -> list[int]:
        if isinstance(data, dict):
            instance = self._build(model, data)
            self.session.add(instance)
            await self.session.flush()
            if hasattr(instance, 'id'):
                return [instance.id]
            else:
                return None

        instances = []
        for item in data:
            if isinstance(item, model):
                # Callers that build the entity themselves hit the same trap:
                # every relationship they did not name is sitting at None.
                self._detach_unset_relationships(item, set())
                instances.append(item)
            elif isinstance(item, dict):
                instances.append(self._build(model, item))
            else:
                raise ValueError('Items in list must be dict or model instances.')

        self.session.add_all(instances)
        await self.session.flush()
        return [obj.id for obj in instances]

    @staticmethod
    def _persistable(value: Any) -> Any:
        """Turn a missing numeric into NULL.

        Rows built from DataFrames carry ``NaN`` where a provider had no value.
        PostgreSQL ``numeric`` accepts NaN, so the write succeeds and the bad
        value only surfaces later, when reading it back fails to serialize to
        JSON. Absent means NULL, so normalize it here, at the single point where
        DataFrame-shaped rows become SQL.
        """
        if isinstance(value, float) and not math.isfinite(value):
            return None
        if isinstance(value, Decimal) and not value.is_finite():
            return None
        return value

    async def upsert_bulk(self, model: ModelType, data: list[dict], unique_columns: list[str]):
        if not unique_columns:
            raise ValueError('unique_columns must be provided for upsert operation')

        table = model.__table__
        table_name = f'{table.schema}.{table.name}' if table.schema else table.name
        model_columns = [col.name for col in inspect(model).columns]
        columns = list(data[0].keys())

        for col in columns:
            if col not in model_columns:
                raise ValueError(f"Column '{col}' is not part of model '{model.__name__}'")

        column_names = ', '.join(columns)
        placeholders = ', '.join(f':{col}' for col in columns)
        update_cols = [col for col in columns if col not in unique_columns]

        if not update_cols:
            raise ValueError('At least one non-unique column is required to update')

        update_stmt = ', '.join(f'{col} = EXCLUDED.{col}' for col in update_cols)
        conflict_keys = ', '.join(unique_columns)

        sql = f"""
            INSERT INTO {table_name} ({column_names})
            VALUES ({placeholders})
            ON CONFLICT ({conflict_keys})
            DO UPDATE SET {update_stmt}
        """

        statement = text(sql)
        for start in range(0, len(data), UPSERT_CHUNK_SIZE):
            rows = [
                {key: self._persistable(value) for key, value in row.items()}
                for row in data[start : start + UPSERT_CHUNK_SIZE]
            ]
            await self.session.execute(statement, rows)

    async def update(
        self,
        model: type[ModelType],
        data: dict | ModelType | list[dict] | list[ModelType],
        *,
        flush: bool = False,
    ) -> list[ModelType]:
        if not isinstance(data, list):
            data = [data]

        merged_instances: list[ModelType] = []

        for item in data:
            if isinstance(item, dict):
                # Same reason as in create: an unmentioned relationship must stay
                # unset, or merge() would null out the column it sits over.
                instance = self._build(model, item)
            elif isinstance(item, model):
                self._detach_unset_relationships(item, set())
                instance = item
            else:
                raise ValueError('Each update item must be a dict or a model instance')

            merged = await self.session.merge(instance)
            merged_instances.append(merged)

        if flush:
            await self.session.flush()

        return merged_instances

    async def delete(
        self,
        model: ModelType,
        id: int | None = None,
        by: dict | None = None,
    ) -> bool:
        if id is not None:
            instance = await self.get(model, id)
            if not instance:
                raise ValueError(f'{model.__name__} not found')
            await self.session.delete(instance)
            return True

        if by:
            stmt = sqlalchemy_delete(model)
            stmt = self._apply_filters(stmt, model, by)
            await self.session.execute(stmt)
            return True

        raise ValueError("You must provide either 'id' or 'by' to delete.")

    @staticmethod
    def query(model: ModelType):
        return select(model)
