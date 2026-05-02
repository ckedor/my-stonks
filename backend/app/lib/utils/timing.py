import asyncio
import functools
import logging
import time

logger = logging.getLogger(__name__)


def timeit(label='Execution'):
    def decorator(func):
        if asyncio.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                start = time.perf_counter()
                result = await func(*args, **kwargs)
                end = time.perf_counter()
                print(f'{label} took {end - start:.4f} seconds')
                return result

            return async_wrapper
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                start = time.perf_counter()
                result = func(*args, **kwargs)
                end = time.perf_counter()
                print(f'{label} took {end - start:.4f} seconds')
                return result

            return sync_wrapper

    return decorator
