import { CITY_CATALOG } from '@/components/city-game/catalog'
import { itemPrice } from '@/components/city-game/economy'
import type { IsoBuilderItem } from '@/components/ui'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CatalogItemChange } from '../../../server/catalog-file'

/* O estúdio do jogo: o rascunho do catálogo e o dinheiro do sandbox.

   O rascunho é o que mudou em cada peça — categoria, subcategoria, preço —
   em relação ao `catalog.ts`. O sandbox já joga com ele, antes de salvar; o
   "Salvar" do catálogo grava o arquivo e o esvazia. Fica neste navegador,
   como o mapa do sandbox. */

/** `price: null` tira o preço fixo: a peça volta a custar o volume dela. */
export type CatalogEdit = Partial<Pick<CatalogItemChange, 'group' | 'subgroup' | 'price'>>

export type MoneyMode = 'unlimited' | 'player'

export interface StudioMoney {
  mode: MoneyMode
  /** O jogador simulado: o patrimônio dá a patente, e a patente o território. */
  patrimonyUsd: number
  dividendsUsd: number
  bonusUsd: number
  /** Construir só no território da patente, como o jogo faz. */
  territory: boolean
}

interface GameStudioState {
  edits: Record<string, CatalogEdit>
  editItem: (id: string, change: CatalogEdit) => void
  discardEdits: () => void
  money: StudioMoney
  setMoney: (change: Partial<StudioMoney>) => void
}

const BASE = new Map(CITY_CATALOG.map(item => [item.id, item]))

/** Tira do rascunho o que voltou a ser igual ao arquivo. */
function normalized(id: string, edit: CatalogEdit): CatalogEdit {
  const base = BASE.get(id)
  if (!base) return {}
  const next: CatalogEdit = {}
  if (edit.group !== undefined && edit.group !== base.group) next.group = edit.group
  if (edit.subgroup !== undefined && edit.subgroup !== base.subgroup) next.subgroup = edit.subgroup
  if (edit.price !== undefined && (edit.price ?? undefined) !== base.price) next.price = edit.price
  return next
}

export const useGameStudioStore = create<GameStudioState>()(
  persist(
    (set) => ({
      edits: {},
      editItem: (id, change) => set(state => {
        const edit = normalized(id, { ...state.edits[id], ...change })
        const { [id]: _, ...rest } = state.edits
        return { edits: Object.keys(edit).length ? { ...rest, [id]: edit } : rest }
      }),
      discardEdits: () => set({ edits: {} }),
      money: { mode: 'unlimited', patrimonyUsd: 25_000, dividendsUsd: 0, bonusUsd: 0, territory: true },
      setMoney: (change) => set(state => ({ money: { ...state.money, ...change } })),
    }),
    { name: 'game-studio' },
  ),
)

/** Uma peça com o rascunho aplicado, sem preço calculado. */
export function draftItem(item: IsoBuilderItem, edit: CatalogEdit | undefined): IsoBuilderItem {
  if (!edit) return item
  const { price, ...rest } = { ...item, ...edit }
  return price == null ? rest : { ...rest, price }
}

const calculated = new Map<string, number>()

/** O preço pelo volume, sem o preço fixo. Medir o volume desenha a receita,
 *  então cada peça é medida uma vez por categoria — a categoria entra porque
 *  há categoria de graça. */
export function calculatedPrice(item: IsoBuilderItem): number {
  const key = `${item.id}\u0000${item.group}`
  if (!calculated.has(key)) calculated.set(key, itemPrice({ ...item, price: undefined }))
  return calculated.get(key)!
}

/** O catálogo como o jogo o veria com o rascunho salvo, já com os preços.
 *  Rascunho de peça que saiu do arquivo é ignorado. */
export const draftCatalog = (edits: Record<string, CatalogEdit>): IsoBuilderItem[] =>
  CITY_CATALOG.map(item => {
    const draft = draftItem(item, edits[item.id])
    return { ...draft, price: draft.price ?? calculatedPrice(draft) }
  })

/** O que o "Salvar" manda ao dev server: o estado final de cada peça mudada. */
export function catalogChanges(edits: Record<string, CatalogEdit>): CatalogItemChange[] {
  return CITY_CATALOG.flatMap(item => {
    const edit = edits[item.id]
    if (!edit) return []
    const draft = draftItem(item, edit)
    return [{ id: item.id, group: draft.group, subgroup: draft.subgroup, price: draft.price ?? null }]
  })
}
