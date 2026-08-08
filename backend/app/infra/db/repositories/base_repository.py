from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, List, Optional, Type, TypeVar

import pandas as pd
from sqlalchemy import Date, DateTime, asc, desc, inspect, select, text
from sqlalchemy import delete as sqlalchemy_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.declarative import DeclarativeMeta
from sqlalchemy.orm import selectinload

ModelType = TypeVar('ModelType')


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
            if isinstance(column.type, (DateTime, Date)) and column.name in df.columns:
                df[column.name] = pd.to_datetime(df[column.name])
        return df

    async def get(
        self,
        model: ModelType,
        id: Optional[int] = None,
        by: Optional[dict] = None,
        order_by: Optional[str] = None,
        first: bool = False,
        as_df: bool = False,
        relations: Optional[list[str]] = None,
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
            elif isinstance(value, DeclarativeMeta):
                return self._serialize_instance(value)
            elif hasattr(value, '__table__'):
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
        relations: Optional[list[str]] = None,
        as_df: bool = False,
    ) -> List[Any] | pd.DataFrame:
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

    async def create(self, model: ModelType, data: dict | list[dict | ModelType]) -> list[int]:
        if isinstance(data, dict):
            instance = model(**data)
            self.session.add(instance)
            await self.session.flush()
            if hasattr(instance, 'id'):
                return [instance.id]
            else:
                return None

        instances = []
        for item in data:
            if isinstance(item, model):
                instances.append(item)
            elif isinstance(item, dict):
                instances.append(model(**item))
            else:
                raise ValueError('Items in list must be dict or model instances.')

        self.session.add_all(instances)
        await self.session.flush()
        return [obj.id for obj in instances]
            

    async def upsert_bulk(self, model: ModelType, data: list[dict], unique_columns: list[str]):
        if not unique_columns:
            raise ValueError("unique_columns must be provided for upsert operation")

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
            raise ValueError("At least one non-unique column is required to update")

        update_stmt = ', '.join(f'{col} = EXCLUDED.{col}' for col in update_cols)
        conflict_keys = ', '.join(unique_columns)

        sql = f"""
            INSERT INTO {table_name} ({column_names})
            VALUES ({placeholders})
            ON CONFLICT ({conflict_keys})
            DO UPDATE SET {update_stmt}
        """

        await self.session.execute(text(sql), data)

    async def update(
        self,
        model: Type[ModelType],
        data: dict | ModelType | list[dict] | list[ModelType],
        *,
        flush: bool = False,
    ) -> list[ModelType]:
        if not isinstance(data, list):
            data = [data]

        merged_instances: List[ModelType] = []

        for item in data:
            if isinstance(item, dict):
                instance = model(**item)
            elif isinstance(item, model):
                instance = item
            else:
                raise ValueError("Each update item must be a dict or a model instance")

            merged = await self.session.merge(instance)
            merged_instances.append(merged)

        if flush:
            await self.session.flush()

        return merged_instances

    async def delete(
        self,
        model: ModelType,
        id: Optional[int] = None,
        by: Optional[dict] = None,
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
