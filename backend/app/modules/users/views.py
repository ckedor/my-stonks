from typing import List

from app.config.settings import settings
from app.infra.db.dependencies import get_repository
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.users.db import get_user_db
from app.modules.users.manager import UserManager
from app.modules.users.domain import User
from app.modules.users.schemas import UserCreate, UserRead, UserUpdate
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=settings.JWT_SECRET, lifetime_seconds=60 * 60 * 24 * 30)


auth_backend = AuthenticationBackend(
    name='jwt',
    transport=BearerTransport(tokenUrl='auth/jwt/login'),
    get_strategy=get_jwt_strategy,
)


async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)


fastapi_users = FastAPIUsers[User, int](
    get_user_manager,
    [auth_backend],
)

# 🔐 Toggle automático baseado no ambiente
if settings.ENVIRONMENT in {'development', 'local'}:
    print('⚠️ Rodando em modo dev/local — rotas liberadas para qualquer usuário!')

    async def current_user():
        return User(
            id=1,
            username='dev',
            email='dev@local',
            hashed_password='fake',
            is_active=True,
            is_superuser=True,
            is_verified=True,
        )

    current_active_user = current_user
    current_superuser = current_user
else:
    current_user = fastapi_users.current_user()
    current_active_user = fastapi_users.current_user(active=True)
    current_superuser = fastapi_users.current_user(superuser=True)


# Superuser guard permanece igual
def superuser_guard(user: User = Depends(current_active_user)) -> User:
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Only superusers can register users.',
        )
    return user


def setup_user_views(app: FastAPI):
    app.include_router(
        fastapi_users.get_auth_router(auth_backend),
        prefix='/auth/jwt',
        tags=['Usuários'],
    )
    app.include_router(
        fastapi_users.get_register_router(UserRead, UserCreate),
        prefix='/auth',
        tags=['Usuários'],
        dependencies=[Depends(superuser_guard)],
    )
    app.include_router(
        fastapi_users.get_users_router(UserRead, UserUpdate),
        prefix='/users',
        tags=['Usuários'],
    )

    @app.get('/users', response_model=List[UserRead], tags=['Usuários'])
    async def list_users(repository: SQLAlchemyRepository = Depends(get_repository)):
        return await repository.get(User, order_by='id')
