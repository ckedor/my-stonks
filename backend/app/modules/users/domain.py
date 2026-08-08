from dataclasses import dataclass


@dataclass(eq=False, kw_only=True)
class User:
    id: int | None = None
    username: str = ''
    email: str
    hashed_password: str
    is_active: bool = True
    is_superuser: bool = False
    is_verified: bool = False
