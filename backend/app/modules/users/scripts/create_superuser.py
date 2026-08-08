from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.infra.db.sync_session import SyncSessionLocal as SessionLocal
from app.modules.users.domain import User

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def run():
    db: Session = SessionLocal()
    try:
        email = input('Email do superusuário: ').strip()

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f'❌ Já existe um usuário com o e-mail: {email}')
            return

        password = input('Senha: ').strip()
        hashed_password = pwd_context.hash(password)

        user = User(
            username=email,
            email=email,
            hashed_password=hashed_password,
            is_active=True,
            is_verified=True,
            is_superuser=True,
        )

        db.add(user)
        db.commit()
        print(f'✅ Superusuário criado com sucesso: {email}')
    finally:
        db.close()
