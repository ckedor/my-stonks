from fastapi import Depends
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.session import get_session
from app.infra.db import bootstrap as _db_bootstrap  # noqa: F401
from app.modules.users.domain import User


async def get_user_db(session: AsyncSession = Depends(get_session)):
    # FastAPI Users requires its SQLAlchemy adapter to receive the raw session.
    # The session stays inside this persistence dependency and never reaches a
    # route, service, task, or domain object.
    yield SQLAlchemyUserDatabase(session, User)
