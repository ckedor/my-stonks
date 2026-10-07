"""How much room each table of the database takes.

Read from the database's own catalog, never kept: the numbers are a photograph
of the moment they are asked for.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TableStorage:
    schema: str
    name: str
    #: The planner's estimate, not a count: counting a large table to draw a
    #: screen would cost more than the screen is worth.
    rows: int
    #: The table itself, with its out-of-line storage (TOAST).
    table_bytes: int
    index_bytes: int

    @property
    def total_bytes(self) -> int:
        return self.table_bytes + self.index_bytes


@dataclass(frozen=True)
class DatabaseStorage:
    #: The whole database, which also holds what no table here accounts for
    #: (the catalog, the write-ahead log still in the data directory).
    database_bytes: int
    tables: list[TableStorage]
