import asyncio
from typing import Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.infra.exceptions import IntegrationBadResponse, IntegrationUnavailable

PROVIDER = 'document_storage'

_MISSING_KEY_CODES = {'NoSuchKey', '404'}


class DocumentStorage(Protocol):
    """Where the bytes of an uploaded document live. The database keeps the rest.

    A key is written once and never rewritten with other bytes: callers derive
    it from the content, so putting the same key twice is the same object.
    """

    async def put(self, key: str, content: bytes, *, content_type: str) -> None: ...

    async def get(self, key: str) -> bytes: ...

    async def delete(self, key: str) -> None: ...


class S3DocumentStorage:
    """A bucket behind the S3 protocol — AWS, R2, B2 or MinIO, told apart by the endpoint.

    boto3 is synchronous, so each call runs in a worker thread; a document is
    at most a few megabytes and is sent in one request.
    """

    def __init__(
        self,
        *,
        bucket: str,
        access_key_id: str,
        secret_access_key: str,
        endpoint_url: str | None = None,
        region: str = 'auto',
    ):
        self.bucket = bucket
        self.client = boto3.client(
            's3',
            endpoint_url=endpoint_url or None,
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(
                signature_version='s3v4',
                connect_timeout=5,
                read_timeout=30,
                retries={'max_attempts': 3, 'mode': 'standard'},
            ),
        )

    async def put(self, key: str, content: bytes, *, content_type: str) -> None:
        await self._call(
            self.client.put_object,
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
        )

    async def get(self, key: str) -> bytes:
        response = await self._call(self.client.get_object, Bucket=self.bucket, Key=key)
        return await asyncio.to_thread(response['Body'].read)

    async def delete(self, key: str) -> None:
        # S3 answers a delete of a missing key with success, so this is idempotent.
        await self._call(self.client.delete_object, Bucket=self.bucket, Key=key)

    @staticmethod
    async def _call(operation, **kwargs):
        try:
            return await asyncio.to_thread(operation, **kwargs)
        except ClientError as error:
            details = error.response.get('Error', {})
            context = {
                'code': details.get('Code'),
                'detail': details.get('Message'),
                'key': kwargs.get('Key'),
            }
            if details.get('Code') in _MISSING_KEY_CODES:
                # The row says the object is there and the bucket says it is
                # not: retrying will not bring it back.
                raise IntegrationBadResponse(
                    'O arquivo não está mais no storage de documentos.',
                    provider=PROVIDER,
                    context=context,
                ) from error
            raise IntegrationUnavailable(
                provider=PROVIDER,
                status_code=error.response.get('ResponseMetadata', {}).get('HTTPStatusCode'),
                context=context,
            ) from error
        except BotoCoreError as error:
            raise IntegrationUnavailable(
                provider=PROVIDER, context={'detail': str(error)}
            ) from error
