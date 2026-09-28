"""The reference ETFs: the listed funds the market screens follow every day,
held or not.

A curated list, not a ranking — the registry has no assets under management
for most of the three thousand US ETFs it knows. It is grouped by what the
fund is exposed to, so a screen can read one exposure against another. Each
ticker is the registered asset's own: a UCITS fund on the London exchange
carries its `.L` suffix.
"""

from dataclasses import dataclass
from enum import StrEnum


class EtfExposure(StrEnum):
    USA = 'usa'
    WORLD = 'world'
    WORLD_EX_USA = 'world_ex_usa'
    EMERGING = 'emerging'
    DIVIDENDS = 'dividends'
    THEMES = 'themes'
    BONDS = 'bonds'
    GOLD = 'gold'
    REAL_ESTATE = 'real_estate'


class EtfListing(StrEnum):
    #: Listed in New York, distributing — the US wrapper.
    US = 'us'
    #: Irish UCITS listed in London: accumulating, and taxed differently for a
    #: Brazilian resident than the US wrapper of the same index.
    UCITS = 'ucits'


@dataclass(frozen=True)
class ReferenceEtf:
    ticker: str
    exposure: EtfExposure
    listing: EtfListing = EtfListing.US


#: In the order a screen shows them: exposure first, then the fund.
REFERENCE_ETFS: tuple[ReferenceEtf, ...] = (
    ReferenceEtf('VOO', EtfExposure.USA),
    ReferenceEtf('IVV', EtfExposure.USA),
    ReferenceEtf('VTI', EtfExposure.USA),
    ReferenceEtf('QQQ', EtfExposure.USA),
    ReferenceEtf('QQQM', EtfExposure.USA),
    ReferenceEtf('CSPX.L', EtfExposure.USA, EtfListing.UCITS),
    ReferenceEtf('VT', EtfExposure.WORLD),
    ReferenceEtf('ACWI', EtfExposure.WORLD),
    ReferenceEtf('VWRA.L', EtfExposure.WORLD, EtfListing.UCITS),
    ReferenceEtf('VXUS', EtfExposure.WORLD_EX_USA),
    ReferenceEtf('VEA', EtfExposure.WORLD_EX_USA),
    ReferenceEtf('IEFA', EtfExposure.WORLD_EX_USA),
    ReferenceEtf('EXUS.L', EtfExposure.WORLD_EX_USA, EtfListing.UCITS),
    ReferenceEtf('VWO', EtfExposure.EMERGING),
    ReferenceEtf('IEMG', EtfExposure.EMERGING),
    ReferenceEtf('EEM', EtfExposure.EMERGING),
    ReferenceEtf('EIMI.L', EtfExposure.EMERGING, EtfListing.UCITS),
    ReferenceEtf('SCHD', EtfExposure.DIVIDENDS),
    ReferenceEtf('VYM', EtfExposure.DIVIDENDS),
    ReferenceEtf('SMH', EtfExposure.THEMES),
    ReferenceEtf('XLK', EtfExposure.THEMES),
    ReferenceEtf('AIQ', EtfExposure.THEMES),
    ReferenceEtf('BOTZ', EtfExposure.THEMES),
    ReferenceEtf('BND', EtfExposure.BONDS),
    ReferenceEtf('AGG', EtfExposure.BONDS),
    ReferenceEtf('TLT', EtfExposure.BONDS),
    ReferenceEtf('GLD', EtfExposure.GOLD),
    ReferenceEtf('IAU', EtfExposure.GOLD),
    ReferenceEtf('VNQ', EtfExposure.REAL_ESTATE),
)
