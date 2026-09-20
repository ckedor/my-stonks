"""The one task every AI feature is scheduled and dispatched through.

There is no task per feature, and that is the point. What a scheduled run does
is always the same — decide which inputs to refresh, then generate each — and
the only feature-specific half, *which inputs*, is declared on the handler. So
a feature becomes schedulable by answering `scheduled_inputs`, and by getting a
line in the beat schedule. No new task, no new route.
"""

from app.composition.ai import build_ai_artifact_service_for_task, build_ai_handler_for_task
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='run_ai_feature')
async def run_ai_feature(feature_key: str, input: dict | None = None) -> dict:
    service = build_ai_artifact_service_for_task()

    if input is not None:
        await service.generate(feature_key, input)
        return {'feature_key': feature_key, 'generated': 1, 'failed': 0}

    handler = build_ai_handler_for_task(feature_key)
    if handler is None:
        logger.warning(f'⚠️ run_ai_feature: a feature "{feature_key}" não tem handler')
        return {'feature_key': feature_key, 'generated': 0, 'failed': 0}

    inputs = await handler.scheduled_inputs()
    logger.info(f'🟢 run_ai_feature {feature_key}: {len(inputs)} entradas para regenerar')

    generated, failed = 0, 0
    for model_input in inputs:
        try:
            await service.generate(feature_key, model_input.model_dump(mode='json'))
            generated += 1
        except Exception:
            # One asset that cannot be described must not stop the other two
            # hundred. The failure is already a row in ai_run; this keeps the
            # run going and reports the tally.
            failed += 1
            logger.exception(f'❌ run_ai_feature {feature_key} falhou em {model_input}')

    return {'feature_key': feature_key, 'generated': generated, 'failed': failed}
