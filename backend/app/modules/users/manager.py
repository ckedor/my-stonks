from fastapi_users import BaseUserManager

from app.config.settings import settings
from app.modules.users.domain import User


class UserManager(BaseUserManager[User, int]):
    reset_password_token_secret = settings.JWT_SECRET
    verification_token_secret = settings.JWT_SECRET

    def parse_id(self, user_id: str) -> int:
        return int(user_id)

    async def on_after_register(self, user: User, request=None):
        print(f'✅ Novo usuário registrado: {user.email}')
