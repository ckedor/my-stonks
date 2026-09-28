"""Celery entrypoint for the task-run history maintenance."""

from app.composition.operations import build_task_run_service
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='maintain_task_run_history')
async def maintain_task_run_history():
    service = build_task_run_service()
    return await service.maintain_history()
