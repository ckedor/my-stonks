"""Ponto de entrada do worker, par de `main_fastapi`.

Quem sobe o worker aponta para cá — `start_worker.sh` e o `launch.json` usam
`-A app.main_celery.celery_app` — enquanto a aplicação Celery em si mora em
`app.entrypoints.worker.celery_app`. Este módulo existe para ligar os dois, e o
bootstrap dos mapeamentos roda antes de qualquer tarefa ser importada.

O `__all__` não é decoração: sem ele o re-export parece um import sem uso, e uma
passada de ruff já removeu essa linha uma vez — o que deixou o worker sem subir,
com um "Unable to load celery application" que não aponta para a causa.
"""

import app.infra.db.bootstrap  # noqa: F401
from app.entrypoints.worker.celery_app import celery_app

__all__ = ['celery_app']
