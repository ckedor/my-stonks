"""What the object bucket holds, by owner."""

from app.infra.storage.document_storage import BucketUsage, DocumentStorage


class BucketReadService:
    def __init__(self, storage: DocumentStorage | None) -> None:
        self.storage = storage

    async def usage(self) -> BucketUsage | None:
        """None when no bucket is configured: a state of the deploy, not an error."""
        if self.storage is None:
            return None
        return await self.storage.usage()
