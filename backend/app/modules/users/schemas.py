from fastapi_users import schemas
from pydantic import computed_field


class UserRead(schemas.BaseUser[int]):
    username: str

    @computed_field
    @property
    def is_admin(self) -> bool:
        return self.is_superuser


class UserCreate(schemas.BaseUserCreate):
    username: str


class UserUpdate(schemas.BaseUserUpdate):
    username: str | None = None
