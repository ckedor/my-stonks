from sqlalchemy import inspect

from app.infra.db.base import Base
from app.infra.db.tables.users import user_table
from app.modules.users.domain import User


def map_users() -> None:
    if inspect(User, raiseerr=False) is not None:
        return
    Base.registry.map_imperatively(User, user_table)
