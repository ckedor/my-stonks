import functools
from collections.abc import Awaitable, Callable
from typing import Any


def cached(
    key_prefix: str,
    cache,
    ttl=3600,
):
    def decorator(func: Callable[..., Awaitable[Any]]):
        @functools.wraps(func)
        async def wrapper(self, *args, **kwargs):
            redis_client = cache(self)

            cache_key = f'{key_prefix}:{":".join(map(str, args))}:{":".join(f"{k}={v}" for k, v in kwargs.items())}'
            cached_result = await redis_client.get_json(cache_key)
            if cached_result is not None:
                return cached_result

            result = await func(self, *args, **kwargs)
            await redis_client.set_json(cache_key, result, expire_seconds=ttl)
            return result

        return wrapper

    return decorator
