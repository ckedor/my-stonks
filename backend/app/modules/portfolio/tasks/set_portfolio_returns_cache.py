from app.config.logger import logger
from app.composition.portfolio import build_portfolio_position_service
from app.entrypoints.worker.task_runner import celery_async_task
from app.infra.db.dependencies import portfolio_market_data_repository_context
from app.infra.redis.redis_service import RedisService


@celery_async_task(name='set_portfolio_returns_cache')
async def set_portfolio_returns_cache(portfolio_id: int):
    logger.info(f'🟢 Iniciando set_portfolio_returns_cache para {portfolio_id}')
    try:
        async with portfolio_market_data_repository_context() as repositories:
            service = build_portfolio_position_service(repositories)
            portfolio_returns = await service.get_consolidated_portfolio_returns(portfolio_id)
            cache = RedisService()
            await cache.set_json(f'portfolio_returns:{portfolio_id}', portfolio_returns)
    except Exception as e:
        logger.error(f'❌ Erro em set_portfolio_returns_cache: {e}', exc_info=True)
