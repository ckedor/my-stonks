import type { IsoBuilderMove, IsoBuilderPlacement } from '@/components/ui'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type NewPiece = Omit<IsoBuilderPlacement, 'id'>

/** A cidade de uma carteira: o que está no mapa e o que saiu num upgrade e
 *  espera ser colocado de volta. */
export interface City {
  placements: IsoBuilderPlacement[]
  pending: string[]
  assetLayoutRevision?: number
  /** Os dividendos cujo bônus o jogador já viu anunciado. O bônus conta no
   *  saldo de qualquer jeito; isto só decide se o aviso ainda abre. */
  seenDividends?: number[]
  /** Quantas áreas do território o jogador já viu anunciadas. */
  seenTerritory?: number
}

const EMPTY_CITY: City = { placements: [], pending: [] }

interface CityBuilderState {
  cities: Record<number, City>
  place: (portfolioId: number, pieces: NewPiece[]) => void
  move: (portfolioId: number, moves: IsoBuilderMove[]) => void
  remove: (portfolioId: number, ids: string[]) => void
  /** Tira a peça do mapa e deixa o sucessor esperando. */
  upgrade: (portfolioId: number, id: string, item: string) => void
  placePending: (portfolioId: number, piece: NewPiece) => void
  reconcileLayout: (portfolioId: number, revision: number, ids: string[]) => void
  replace: (portfolioId: number, id: string, item: string) => void
  markDividendsSeen: (portfolioId: number, ids: number[]) => void
  markTerritorySeen: (portfolioId: number, count: number) => void
  clear: (portfolioId: number) => void
}

export const cityOf = (cities: Record<number, City>, portfolioId: number | undefined) =>
  portfolioId == null ? EMPTY_CITY : cities[portfolioId] ?? EMPTY_CITY

/** O jogo da cidade, uma por carteira.
 *
 *  Estado de cliente, por enquanto: a cidade vive neste navegador. O dinheiro
 *  que ela gasta não mora aqui — é o patrimônio e os dividendos da carteira,
 *  lidos do servidor a cada visita —, só o que foi construído. Quando o jogo
 *  tiver de acompanhar o jogador entre aparelhos, estas peças passam a ser
 *  dado de servidor, e este store sai. */
export const useCityBuilderStore = create<CityBuilderState>()(
  persist(
    (set) => {
      const edit = (portfolioId: number, change: (city: City) => City) =>
        set(state => ({ cities: { ...state.cities, [portfolioId]: change(cityOf(state.cities, portfolioId)) } }))
      return {
        cities: {},
        place: (portfolioId, pieces) => edit(portfolioId, city => ({
          ...city, placements: [...city.placements, ...pieces.map(piece => ({ id: crypto.randomUUID(), ...piece }))],
        })),
        move: (portfolioId, moves) => edit(portfolioId, city => {
          const to = new Map(moves.map(spot => [spot.id, spot]))
          return { ...city, placements: city.placements.map(placement => ({ ...placement, ...to.get(placement.id) })) }
        }),
        remove: (portfolioId, ids) => edit(portfolioId, city => {
          const gone = new Set(ids)
          return { ...city, placements: city.placements.filter(placement => !gone.has(placement.id)) }
        }),
        upgrade: (portfolioId, id, item) => edit(portfolioId, city => ({
          ...city,
          placements: city.placements.filter(placement => placement.id !== id),
          pending: [...city.pending, item],
        })),
        placePending: (portfolioId, piece) => edit(portfolioId, city => {
          const at = city.pending.indexOf(piece.item)
          if (at < 0) return city
          return {
            ...city,
            pending: city.pending.filter((_, i) => i !== at),
            placements: [...city.placements, { id: crypto.randomUUID(), ...piece }],
          }
        }),
        reconcileLayout: (portfolioId, revision, ids) => edit(portfolioId, city => {
          if ((city.assetLayoutRevision ?? 0) >= revision) return city
          const displaced = new Set(ids)
          return { ...city, assetLayoutRevision: revision,
            pending: [...city.pending, ...city.placements.filter(piece => displaced.has(piece.id)).map(piece => piece.item)],
            placements: city.placements.filter(piece => !displaced.has(piece.id)),
          }
        }),
        replace: (portfolioId, id, item) => edit(portfolioId, city => ({
          ...city, placements: city.placements.map(placement => placement.id === id ? { ...placement, item } : placement),
        })),
        markDividendsSeen: (portfolioId, ids) => edit(portfolioId, city => ({
          ...city, seenDividends: [...new Set([...(city.seenDividends ?? []), ...ids])],
        })),
        markTerritorySeen: (portfolioId, count) => edit(portfolioId, city => ({
          ...city, seenTerritory: Math.max(city.seenTerritory ?? 0, count),
        })),
        clear: (portfolioId) => edit(portfolioId, () => EMPTY_CITY),
      }
    },
    // Chave nova: a demo guardava um terreno de 20 × 20 sem dinheiro.
    { name: 'city-game' },
  ),
)
