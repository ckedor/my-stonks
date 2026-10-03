#!/bin/sh

echo "==> Rodando migrations Alembic"
alembic upgrade head

# Uma migração grava linhas por fora dos services, e é o service que derruba o
# cache que a escrita dele torna velho. Ver app/infra/redis/drop_cache.py.
echo "==> Limpando o cache de leituras"
python manage.py drop_cache

echo "==> Iniciando FastAPI com Uvicorn"
uvicorn app.main_fastapi:app --host=0.0.0.0 --port=10000