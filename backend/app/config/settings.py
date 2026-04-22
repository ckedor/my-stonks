from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: Literal['development', 'production', 'testing']
    DATABASE_URL: str
    REDIS_URL: str

    BRAPI_API_TOKEN: str
    ALPHAVANTAGE_KEY: str
    CRYPTO_COMPARE_API_KEY: str
    OPENAI_API_KEY: str = ''
    JWT_SECRET: str

    CORS_ORIGINS: list[str] = [
        'https://my-stonks-front.onrender.com',
        'http://localhost:5173',
        'http://localhost:3000',
    ]

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    @field_validator('DATABASE_URL', mode='before')
    @classmethod
    def fix_postgres_scheme(cls, v: str) -> str:
        return v.replace('postgres://', 'postgresql://') if v else v

    @field_validator('REDIS_URL', mode='before')
    @classmethod
    def add_ssl_cert_reqs_if_rediss(cls, v: str) -> str:
        if v.startswith('rediss://') and 'ssl_cert_reqs' not in v:
            return v + '?ssl_cert_reqs=CERT_NONE'
        return v


settings = Settings()

if settings.ENVIRONMENT == 'testing':
    settings = Settings(_env_file='.env.test')
elif settings.ENVIRONMENT == 'development':
    settings = Settings(_env_file='.env')
