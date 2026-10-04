import type { IsoBuilderMove, IsoBuilderPlacement } from '@/components/ui'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface GameSandboxState {
  assetLayoutRevision: number
  reconcileLayout: (revision: number, ids: string[]) => void
  placements: IsoBuilderPlacement[]
  /** Peças que saíram do mapa num upgrade e esperam ser colocadas. */
  pending: string[]
  /** Tira a peça do mapa e deixa o sucessor esperando. */
  upgrade: (id: string, item: string) => void
  /** Coloca uma peça que esperava. */
  placePending: (piece: Omit<IsoBuilderPlacement, 'id'>) => void
  place: (pieces: Omit<IsoBuilderPlacement, 'id'>[]) => void
  move: (moves: IsoBuilderMove[]) => void
  remove: (ids: string[]) => void
  replace: (id: string, item: string) => void
  clear: () => void
}

/** O mapa do sandbox do estúdio do jogo: começa vazio e fica neste
 *  navegador, na origem do `tools/` — não é a cidade de nenhuma carteira. */
export const useGameSandboxStore = create<GameSandboxState>()(
  persist(
    (set) => ({
      placements: [],
      pending: [],
      assetLayoutRevision: 0,
      reconcileLayout: (revision, ids) => set(state => {
        if (state.assetLayoutRevision >= revision) return state
        const displaced = new Set(ids)
        return { assetLayoutRevision: revision,
          pending: [...state.pending, ...state.placements.filter(piece => displaced.has(piece.id)).map(piece => piece.item)],
          placements: state.placements.filter(piece => !displaced.has(piece.id)),
        }
      }),
      upgrade: (id, item) => set(state => ({
        placements: state.placements.filter(placement => placement.id !== id),
        pending: [...state.pending, item],
      })),
      placePending: (piece) => set(state => {
        const at = state.pending.indexOf(piece.item)
        if (at < 0) return state
        return {
          pending: state.pending.filter((_, i) => i !== at),
          placements: [...state.placements, { id: crypto.randomUUID(), ...piece }],
        }
      }),
      place: (pieces) => set(state => ({
        placements: [...state.placements, ...pieces.map(piece => ({ id: crypto.randomUUID(), ...piece }))],
      })),
      move: (moves) => set(state => {
        const to = new Map(moves.map(spot => [spot.id, spot]))
        return { placements: state.placements.map(placement => ({ ...placement, ...to.get(placement.id) })) }
      }),
      remove: (ids) => set(state => {
        const gone = new Set(ids)
        return { placements: state.placements.filter(placement => !gone.has(placement.id)) }
      }),
      replace: (id, item) => set(state => ({
        placements: state.placements.map(placement => placement.id === id ? { ...placement, item } : placement),
      })),
      clear: () => set({ placements: [], pending: [] }),
    }),
    { name: 'game-sandbox' },
  ),
)
