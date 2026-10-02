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
    ANTHROPIC_API_KEY: str = ''
    JWT_SECRET: str

    # Tracing de IA. Sem as duas chaves o app roda sem trace, de propósito:
    # é infraestrutura opcional, como o cache.
    LANGFUSE_PUBLIC_KEY: str = ''
    LANGFUSE_SECRET_KEY: str = ''
    LANGFUSE_HOST: str = 'https://cloud.langfuse.com'

    # Teto de gasto diário com IA, em dólares. Acima dele a geração é recusada.
    # Existe porque uma chave de API é um cartão de crédito sem limite, e um
    # laço que regenera o mesmo artefato gastaria até alguém perceber.
    AI_DAILY_COST_LIMIT_USD: float = 5.0

    # Quem pergunta, para a SEC: nome e e-mail de contato ("my-stonks voce@x.com").
    # A política de acesso dela recusa com 403 quem não se identifica, então
    # sem isto o cadastro de ETFs americanos falha — e diz por quê.
    SEC_USER_AGENT: str = ''

    # Opcional. Sem ela o OpenFIGI atende 10 ISINs por pedido, 25 pedidos por
    # minuto; com ela (gratuita), 100 por pedido — só acelera a primeira leva.
    OPENFIGI_API_KEY: str = ''

    # Storage dos documentos enviados à carteira (notas, extratos): qualquer
    # bucket que fale S3 — R2, B2, S3, MinIO no docker-compose. Sem bucket e
    # sem as duas chaves o app roda e lê o PDF como antes, só não o guarda: a
    # leitura devolve `document_id` nulo, e é isso que a tela mostra.
    STORAGE_BUCKET: str = ''
    STORAGE_ACCESS_KEY_ID: str = ''
    STORAGE_SECRET_ACCESS_KEY: str = ''
    # Vazio é a AWS. R2, B2 e MinIO têm endpoint próprio.
    STORAGE_ENDPOINT_URL: str = ''
    STORAGE_REGION: str = 'auto'

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
