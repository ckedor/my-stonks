from enum import Enum


class StatementScope(str, Enum):
    PORTFOLIO = 'portfolio'
    ASSET = 'asset'
    CATEGORY = 'category'
    CUSTOM = 'custom'
