from enum import StrEnum


class AssetType(StrEnum):
    ETF = 'ETF'
    FII = 'FII'
    TREASURY = 'TREASURY'
    STOCK = 'STOCK'
    BDR = 'BDR'
    PREV = 'PREV'
    FI = 'FI'
    CDB = 'CDB'
    DEB = 'DEB'
    CRI = 'CRI'
    CRA = 'CRA'
    REIT = 'REIT'
    CRIPTO = 'CRIPTO'
    LCA = 'LCA'


class EXCHANGE(StrEnum):
    B3 = "B3"
    NASDAQ = "NASDAQ"
    NYSE = "NYSE"