"""O adapter S3 manda o que o bucket espera e traduz o que ele recusa."""

import io
from datetime import UTC, datetime

import pytest
from botocore.stub import Stubber

from app.infra.exceptions import IntegrationBadResponse, IntegrationUnavailable
from app.infra.storage.document_storage import S3DocumentStorage

KEY = 'portfolio/1/brokerage_note/abc.pdf'
PDF = b'%PDF-1.7 nota'


@pytest.fixture
def storage():
    return S3DocumentStorage(
        bucket='documents',
        access_key_id='key',
        secret_access_key='secret',
        endpoint_url='http://localhost:9000',
    )


async def test_put_sends_the_bytes_to_the_configured_bucket(storage):
    with Stubber(storage.client) as stub:
        stub.add_response(
            'put_object',
            {},
            {'Bucket': 'documents', 'Key': KEY, 'Body': PDF, 'ContentType': 'application/pdf'},
        )

        await storage.put(KEY, PDF, content_type='application/pdf')

        stub.assert_no_pending_responses()


async def test_get_returns_the_object_body(storage):
    with Stubber(storage.client) as stub:
        stub.add_response(
            'get_object', {'Body': io.BytesIO(PDF)}, {'Bucket': 'documents', 'Key': KEY}
        )

        assert await storage.get(KEY) == PDF


async def test_a_missing_object_is_a_bad_response_not_an_outage(storage):
    with Stubber(storage.client) as stub:
        stub.add_client_error('get_object', service_error_code='NoSuchKey', http_status_code=404)

        with pytest.raises(IntegrationBadResponse):
            await storage.get(KEY)


async def test_a_refused_request_is_reported_as_the_storage_being_unavailable(storage):
    with Stubber(storage.client) as stub:
        stub.add_client_error('put_object', service_error_code='AccessDenied', http_status_code=403)

        with pytest.raises(IntegrationUnavailable) as raised:
            await storage.put(KEY, PDF, content_type='application/pdf')

    assert (raised.value.status_code, raised.value.context['code']) == (403, 'AccessDenied')


async def test_delete_removes_the_key(storage):
    with Stubber(storage.client) as stub:
        stub.add_response('delete_object', {}, {'Bucket': 'documents', 'Key': KEY})

        await storage.delete(KEY)

        stub.assert_no_pending_responses()


async def test_usage_groups_the_bucket_by_top_level_folder_largest_first(storage):
    early = datetime(2026, 1, 1, tzinfo=UTC)
    late = datetime(2026, 9, 1, tzinfo=UTC)
    with Stubber(storage.client) as stub:
        stub.add_response(
            'list_objects_v2',
            {
                'Contents': [
                    {'Key': 'portfolio/1/brokerage_note/a.pdf', 'Size': 300, 'LastModified': early},
                    {
                        'Key': 'portfolio/2/position_statement/b.pdf',
                        'Size': 200,
                        'LastModified': late,
                    },
                    {'Key': 'exports/x.csv', 'Size': 900, 'LastModified': early},
                    {'Key': 'loose.txt', 'Size': 5, 'LastModified': early},
                ],
                'IsTruncated': False,
            },
            {'Bucket': 'documents'},
        )

        usage = await storage.usage()

    assert [(p.prefix, p.objects, p.bytes) for p in usage.prefixes] == [
        ('exports', 1, 900),
        ('portfolio', 2, 500),
        ('', 1, 5),
    ]
    assert usage.prefixes[1].last_modified == late
    assert (usage.objects, usage.bytes, usage.truncated) == (4, 1405, False)


async def test_usage_of_an_unreachable_bucket_is_an_outage(storage):
    with Stubber(storage.client) as stub:
        stub.add_client_error(
            'list_objects_v2', service_error_code='AccessDenied', http_status_code=403
        )

        with pytest.raises(IntegrationUnavailable):
            await storage.usage()
