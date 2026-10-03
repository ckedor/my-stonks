"""Drop every cached read, for when rows changed behind the services' back.

A service that commits a write drops the cached reads it makes stale. Two
writers skip the services: a migration that inserts rows (the UCITS ETFs were
registered that way, and the asset list kept answering without them for a
day), and restoring a database dump, after which every cached id may name
another row. Both end by running this.

Only keys under the cache's own prefix go: whatever else lives in the same
Redis is not a cached read. The cache is optional, so an unreachable Redis is
reported and does not fail the deploy or the restore.
"""

import asyncio

from app.infra.redis.redis_service import RedisService


async def _drop() -> int:
    service = RedisService()
    try:
        return await service.delete_prefix('')
    finally:
        await service.client.aclose()


def run() -> None:
    try:
        deleted = asyncio.run(_drop())
    except Exception as exc:  # the cache is optional
        print(f'⚠️  Cache não foi limpo ({exc.__class__.__name__}: {exc}); segue sem ele.')
        return
    print(f'🧹 Cache limpo: {deleted} chave(s).')
