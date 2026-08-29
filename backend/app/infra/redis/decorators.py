import functools
import inspect
from collections.abc import Awaitable, Callable
from typing import Any

from app.config.logger import logger


def cached(
    key_prefix: str,
    cache,
    ttl=3600,
):
    """Cache an async read under a key built from its bound arguments.

    The key lists the parameters in declaration order, after binding and
    applying defaults, so ``f(1, currency='BRL')`` and
    ``f(1, None, None, currency='BRL')`` are one entry and not two. That order
    has to come from the signature rather than from how the caller happened to
    write the call, because invalidation matches a prefix of this key: keying on
    the call shape means a caller switching to ``portfolio_id=1`` silently moves
    the entry out from under the prefix that would have deleted it.

    Two things a cache owes its caller. It is optional infrastructure, so a
    Redis that is down makes a read slow and never failed. And ``None`` is not
    stored: it reads back as a miss anyway, so writing it only buys a key.
    """

    def decorator(func: Callable[..., Awaitable[Any]]):
        signature = inspect.signature(func)

        @functools.wraps(func)
        async def wrapper(self, *args, **kwargs):
            redis_client = cache(self)
            cache_key = _build_key(key_prefix, signature, self, args, kwargs)

            try:
                cached_result = await redis_client.get_json(cache_key)
            except Exception as exc:
                logger.warning('Cache read failed for %s: %s', cache_key, exc)
            else:
                if cached_result is not None:
                    return cached_result

            result = await func(self, *args, **kwargs)

            if result is not None:
                try:
                    await redis_client.set_json(cache_key, result, expire_seconds=ttl)
                except Exception as exc:
                    logger.warning('Cache write failed for %s: %s', cache_key, exc)

            return result

        return wrapper

    return decorator


def _build_key(
    key_prefix: str,
    signature: inspect.Signature,
    instance: Any,
    args: tuple,
    kwargs: dict,
) -> str:
    """The canonical key for one call: the prefix, then every argument in order.

    ``self`` is dropped -- it is the service holding the cache, not part of the
    question being asked.
    """
    bound = signature.bind(instance, *args, **kwargs)
    bound.apply_defaults()
    arguments = list(bound.arguments.values())[1:]
    return f'{key_prefix}:' + ':'.join(map(str, arguments))
