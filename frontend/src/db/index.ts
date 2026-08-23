import Dexie, { type EntityTable } from 'dexie'

// ---------------------------------------------------------------------------
// Cache entry – each row is a full dataset snapshot keyed by a string key.
//
//  Examples of keys:
//    "portfolios"           → portfolio list
//    "positions:42"         → positions for portfolio 42
//    "returns:42"           → returns  for portfolio 42
//    "analysis:42"          → analysis for portfolio 42
//    "benchmarks:BRL"       → benchmark time-series restated in BRL
//    "benchmarks:USD"       → benchmark time-series restated in USD
// ---------------------------------------------------------------------------

export interface CacheEntry {
  /** Unique key identifying this cached dataset */
  key: string
  /** The serialisable data payload */
  data: unknown
  /** Fast hash of `data` (SHA-256 hex) for stale-while-revalidate comparison */
  hash: string
  /** Epoch ms when this entry was last written */
  updatedAt: number
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

class MyStonksDB extends Dexie {
  cache!: EntityTable<CacheEntry, 'key'>

  constructor() {
    super('my-stonks')
    this.version(1).stores({
      cache: 'key',
    })
  }
}

export const db = new MyStonksDB()
