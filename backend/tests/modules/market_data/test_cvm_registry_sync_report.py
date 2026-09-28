"""The CVM sync report fits the response it is served in.

It did not: an asset gaining its issuer carries `institution_id` as an integer,
the response schema wants text, and the dry run of "Companhias e emissores"
failed with a 500 for every stock it would link.
"""

from types import SimpleNamespace

import pytest

from app.modules.market_data.api.asset.schemas import CvmRegistrySyncReport
from app.modules.market_data.service.cvm_registry_sync_service import CvmRegistrySyncService

pytestmark = pytest.mark.unit


async def test_an_asset_linked_to_its_issuer_is_reported_as_text():
    service = CvmRegistrySyncService(uow=None, client=None)
    report = {
        'dry_run': True,
        'institutions': {'created': [], 'updated': [], 'unchanged': 0},
        'assets': {'updated': [], 'unchanged': 0, 'unmatched': [], 'skipped_foreign': 0},
    }
    asset = SimpleNamespace(ticker='petr4')

    await service._collect(
        report, asset, {'institution_id': (None, 1967), 'exchange_id': (None, 1)}, True, None
    )

    served = CvmRegistrySyncReport.model_validate(report)
    assert served.assets.updated[0].changes['institution_id'] == (None, '1967')
