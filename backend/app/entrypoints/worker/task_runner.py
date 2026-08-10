import asyncio
from functools import wraps

from app.config.logger import logger
from app.entrypoints.worker.celery_app import celery_app

worker_loop = asyncio.new_event_loop()
asyncio.set_event_loop(worker_loop)


def run_task(task_func, *args, **kwargs):
    return task_func.delay(*args, **kwargs)


def run_task_by_name(task_name: str, *args, **kwargs):
    """Dispatch a task the caller must not import.

    Lets an entrypoint in one module enqueue a job owned by another without
    taking a code dependency on it, which is how the quote-ingestion route
    reaches the portfolio task that selects held assets.
    """
    return celery_app.send_task(task_name, args=args, kwargs=kwargs)


def revoke_task(task_id: str) -> None:
    """Drop a task that has not been picked up by a worker yet.

    A task already running is not interrupted: the worker runs a solo pool, so
    there is no child process to signal. Stopping one is cooperative, driven by
    the aborted execution its runner reads between items.
    """
    celery_app.control.revoke(task_id)


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
