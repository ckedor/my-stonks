from app.config.logger import logger
from app.composition.portfolio import build_portfolio_position_service
from app.entrypoints.worker.task_runner import celery_async_task
from app.infra.db.dependencies import portfolio_market_data_repository_context
from app.infra.redis.redis_service import RedisService


@celery_async_task(name='set_patrimony_evolution_cache')
async def set_patrimony_evolution_cache(portfolio_id: int):
    logger.info(f'🟢 Iniciando set_patrimony_evolution_cache para {portfolio_id}')
    try:
        async with portfolio_market_data_repository_context() as repositories:
            service = build_portfolio_position_service(repositories)
            patrimony_evolution = await service.compute_patrimony_evolution(portfolio_id)
            cache = RedisService()
            await cache.set_json(f'patrimony_evolution:{portfolio_id}', patrimony_evolution)
    except Exception as e:
        logger.error(f'❌ Erro em set_patrimony_evolution_cache: {e}', exc_info=True)
