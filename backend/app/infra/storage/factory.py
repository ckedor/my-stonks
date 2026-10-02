from functools import lru_cache

from app.config.settings import settings
from app.infra.storage.document_storage import DocumentStorage, S3DocumentStorage


@lru_cache(maxsize=1)
def get_document_storage() -> DocumentStorage | None:
    """The process-wide document storage, or None when no bucket is configured.

    None is a state the callers handle, not an error: an upload is still read,
    it is just not kept, and the reading says so. A bucket with half of its
    credentials is a configuration mistake and fails here, at the first use,
    rather than as a 403 on somebody's upload.
    """
    configured = {
        'STORAGE_BUCKET': settings.STORAGE_BUCKET,
        'STORAGE_ACCESS_KEY_ID': settings.STORAGE_ACCESS_KEY_ID,
        'STORAGE_SECRET_ACCESS_KEY': settings.STORAGE_SECRET_ACCESS_KEY,
    }
    if not any(configured.values()):
        return None
    missing = [name for name, value in configured.items() if not value]
    if missing:
        raise RuntimeError(f'Storage de documentos configurado pela metade: falta {missing}.')
    return S3DocumentStorage(
        bucket=settings.STORAGE_BUCKET,
        access_key_id=settings.STORAGE_ACCESS_KEY_ID,
        secret_access_key=settings.STORAGE_SECRET_ACCESS_KEY,
        endpoint_url=settings.STORAGE_ENDPOINT_URL or None,
        region=settings.STORAGE_REGION,
    )
