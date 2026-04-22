from enum import StrEnum


class TaxableAssetType(StrEnum):
    STOCK = 'STOCK'
    FII = 'FII'
    ETF = 'ETF'
    CRIPTO = 'CRIPTO'


TAX_RATE_FII = 0.20
TAX_RATE_ETF = 0.15
TAX_RATE_CRYPTO = 0.15
TAX_RATE_STOCK = 0.15

# Limites de isenção
FREE_TAX_LIMIT_STOCK = 20000.0
FREE_TAX_LIMIT_CRYPTO = 35000.0