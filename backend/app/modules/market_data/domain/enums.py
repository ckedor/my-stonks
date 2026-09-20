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
    B3 = 'B3'
    NASDAQ = 'NASDAQ'
    NYSE = 'NYSE'


class AssetStatus(StrEnum):
    """Se o papel ainda existe, e por que não existe mais.

    Cadastral apenas: a seleção da ingestão de cotação não olha para ele, de
    propósito. Mudar quem recebe cotação é mudança de comportamento e foi
    deixada para quando doer.
    """

    ACTIVE = 'active'
    MATURED = 'matured'
    DELISTED = 'delisted'
    CANCELLED = 'cancelled'
