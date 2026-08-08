import asyncio
from functools import wraps

from app.config.logger import logger
from app.entrypoints.worker.celery_app import celery_app

worker_loop = asyncio.new_event_loop()
asyncio.set_event_loop(worker_loop)


def run_task(task_func, *args, **kwargs):
    return task_func.delay(*args, **kwargs)


def celery_async_task(name: str | None = None, **task_kwargs):
    def decorator(async_fn):
        task_name = name or async_fn.__name__

        @celery_app.task(name=task_name, **task_kwargs)
        @wraps(async_fn)
        def wrapper(*args, **kwargs):
            logger.info(f'🟢 Iniciando task {task_name} args={args} kwargs={kwargs}')
            try:
                return worker_loop.run_until_complete(async_fn(*args, **kwargs))
            except Exception:
                logger.exception(f'❌ Erro na task {task_name}')
                raise

        return wrapper

    return decorator
