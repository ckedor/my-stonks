import json
from typing import Optional

from redis.asyncio import Redis

from app.config.settings import settings


class RedisService:
    def __init__(self):
        self.client: Redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.prefix = 'cache'

    def _format_key(self, key: str) -> str:
        return f'{self.prefix}:{key}'

    async def set_json(self, key: str, value: dict, expire_seconds: Optional[int] = None) -> None:
        full_key = self._format_key(key)
        if isinstance(value, str):
            data = value
        else:
            data = json.dumps(value, allow_nan=False)
        await self.client.set(full_key, data, ex=expire_seconds)

    async def get_json(self, key: str) -> Optional[dict]:
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
        rather than ``keys`` to avoid blocking Redis on large keyspaces.
        """
        pattern = f'{self._format_key(key_prefix)}*'
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
