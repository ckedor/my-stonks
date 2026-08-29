import json
from functools import lru_cache

from redis.asyncio import Redis

from app.config.settings import settings

#: Characters Redis reads as pattern syntax in a ``SCAN MATCH`` glob. A key
#: carrying one of them would turn a prefix into a pattern, so ``delete_prefix``
#: escapes them before matching.
_GLOB_METACHARACTERS = frozenset('\\*?[]')


@lru_cache(maxsize=1)
def _shared_client() -> Redis:
    """One connection pool for the process.

    ``RedisService`` is constructed per request and per task, and a client per
    instance is a pool per instance that nothing ever closes.
    """
    return Redis.from_url(settings.REDIS_URL, decode_responses=True)


def _escape_glob(value: str) -> str:
    return ''.join(f'\\{char}' if char in _GLOB_METACHARACTERS else char for char in value)


class RedisService:
    def __init__(self):
        self.client: Redis = _shared_client()
        self.prefix = 'cache'

    def _format_key(self, key: str) -> str:
        return f'{self.prefix}:{key}'

    async def set_json(self, key: str, value: dict, expire_seconds: int | None = None) -> None:
        full_key = self._format_key(key)
        data = value if isinstance(value, str) else json.dumps(value, allow_nan=False)
        await self.client.set(full_key, data, ex=expire_seconds)

    async def get_json(self, key: str) -> dict | None:
        full_key = self._format_key(key)
        data = await self.client.get(full_key)
        if data:
            return json.loads(data)
        return None

    async def delete(self, key: str) -> None:
        full_key = self._format_key(key)
        await self.client.delete(full_key)

    async def delete_prefix(self, key_prefix: str) -> int:
        """Drop every key under ``key_prefix``, returning how many were removed.

        Cached read keys carry the call arguments as a suffix, so invalidating
        one derived value means removing a whole family of keys. Uses ``scan``
        rather than ``keys`` to avoid blocking Redis on large keyspaces, and
        escapes the prefix so only the trailing ``*`` is pattern syntax.
        """
        pattern = f'{_escape_glob(self._format_key(key_prefix))}*'
        deleted = 0
        async for batch in self._scan_batches(pattern):
            deleted += await self.client.delete(*batch)
        return deleted

    async def _scan_batches(self, pattern: str, batch_size: int = 500):
        cursor = 0
        while True:
            cursor, keys = await self.client.scan(cursor, match=pattern, count=batch_size)
            if keys:
                yield keys
            if cursor == 0:
                return
