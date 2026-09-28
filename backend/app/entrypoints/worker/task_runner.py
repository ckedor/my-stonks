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


def _trigger(request) -> str:
    """Who sent this run: another task, the scheduler, or a person.

    A task sent from inside another carries its sender as parent. The scheduler
    marks its messages with a header (see celery_app). Anything else came from
    a screen.
    """
    if getattr(request, 'parent_id', None):
        return 'chained'
    return getattr(request, 'trigger', None) or 'manual'


async def _recorded(task_name: str, request, async_fn, args, kwargs):
    """Run the task inside its run record.

    The record never decides the task's fate: a record that cannot be written
    is logged and the task runs anyway, and what the task raises is raised
    again after its run is closed.
    """
    # Imported here: the composition root imports services that import this
    # module's siblings, and the worker only needs it once a task runs.
    from app.composition.operations import build_task_run_service

    service = build_task_run_service()
    run_id = None
    try:
        run_id = await service.start(
            task_name=task_name,
            celery_task_id=getattr(request, 'id', None),
            parent_task_id=getattr(request, 'parent_id', None),
            trigger=_trigger(request),
            args=args,
            kwargs=kwargs,
        )
    except Exception:
        logger.exception(f'⚠️ Não foi possível registrar o início da task {task_name}')

    try:
        result = await async_fn(*args, **kwargs)
    except Exception as exc:
        if run_id is not None:
            try:
                await service.finish(run_id, error=f'{type(exc).__name__}: {exc}')
            except Exception:
                logger.exception(f'⚠️ Não foi possível registrar a falha da task {task_name}')
        raise

    if run_id is not None:
        try:
            await service.finish(run_id, result=result)
        except Exception:
            logger.exception(f'⚠️ Não foi possível registrar o fim da task {task_name}')
    return result


def celery_async_task(name: str | None = None, **task_kwargs):
    """Register an async function as a task, recorded in `operations.task_run`.

    Every task goes through here, so every run is recorded without the task
    doing anything: the operations screen reads the record, and a task that
    had to remember to write its own would be the one that forgot.
    """

    def decorator(async_fn):
        task_name = name or async_fn.__name__

        @celery_app.task(name=task_name, bind=True, **task_kwargs)
        @wraps(async_fn)
        def wrapper(self, *args, **kwargs):
            logger.info(f'🟢 Iniciando task {task_name} args={args} kwargs={kwargs}')
            try:
                return worker_loop.run_until_complete(
                    _recorded(task_name, self.request, async_fn, args, kwargs)
                )
            except Exception:
                logger.exception(f'❌ Erro na task {task_name}')
                raise

        return wrapper

    return decorator
