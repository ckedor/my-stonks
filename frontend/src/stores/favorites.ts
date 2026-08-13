import { fetchFavoriteAssets, recordAssetVisit, type FavoriteAsset } from '@/api/market'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** How many the store keeps. Consumers show fewer and slice what they need,
 *  so the ranking is fetched once for the whole app rather than per widget. */
const FAVORITES_LIMIT = 12

interface FavoritesState {
  favorites: FavoriteAsset[]
  /** Reloads the ranking, keeping the current one on screen until it lands. */
  refresh: () => Promise<void>
  /** Counts a visit and reranks once the backend has taken it. */
  recordVisit: (assetId: number) => void
}

// One refresh at a time: the topbar menu and the asset list both ask on
// mount, and they should share the request rather than race for it.
let inFlight: Promise<void> | null = null

/** The user's most visited assets, kept in the client and persisted.
 *
 *  The ranking barely moves between visits, so it is rendered straight from
 *  the persisted state and refreshed behind it. Fetching on every menu open
 *  made the shortcut appear a beat after the menu did, which read as a flash. */
export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      refresh: () => {
        if (inFlight) return inFlight

        const request = fetchFavoriteAssets(FAVORITES_LIMIT)
          .then((favorites) => {
            set({ favorites })
          })
          // A ranking that fails to load is not worth a message: what is
          // already on screen stays, and the next open tries again.
          .catch(() => undefined)
          .finally(() => {
            inFlight = null
          })
        inFlight = request
        return request
      },

      recordVisit: (assetId) => {
        // The count the ranking sorts by only changes server-side, so the
        // fresh order comes from a reload once the visit has landed rather
        // than from local arithmetic.
        void recordAssetVisit(assetId).then(() => get().refresh())
      },
    }),
    {
      name: 'favorites-store',
      partialize: (state) => ({ favorites: state.favorites }),
    },
  ),
)
