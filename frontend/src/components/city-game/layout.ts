import { type IsoBuilderItem, type IsoBuilderPlacement } from '@/components/ui'
import { isoPieceSize } from '@/components/ui/city'
import { parseAssetBuildingId } from './asset-buildings'

/** Bumped whenever an asset's footprint can change — the enlarged monument
 *  scale, the FII tortoise — or the map's coasts move — 21, the two big
 *  islands; 22, the archipelago with no mainland. A saved city is reconciled once on
 *  opening. */
export const ASSET_LAYOUT_REVISION = 22

/** Any piece left standing in water — the coast moved under it — goes to
 * the pending tray, so it is put down again rather than lost; it costs
 * nothing until then. Where pieces only overlap, decorations stay where the
 * player put them and enlarged assets are the ones moved, preserving the
 * holding and finish rather than silently overlapping another piece. */
export function displacedAssets(
  placements: IsoBuilderPlacement[], items: Map<string, IsoBuilderItem>, size: number,
  isLand: (x: number, y: number) => boolean,
): string[] {
  const resized = (id: string) => !!parseAssetBuildingId(id) || id === 'woolworth-building' || id === 'woolworth-building-codex'
  const occupied = new Set<string>(), displaced: string[] = []
  const ordered = [...placements].sort((a, b) => Number(resized(a.item)) - Number(resized(b.item)))
  for (const placement of ordered) {
    const item = items.get(placement.item)
    if (!item) continue
    const [a, b] = isoPieceSize(item.recipe), [w, d] = placement.rotation % 2 ? [b, a] : [a, b]
    const cells: string[] = []
    let onLand = true, free = true
    for (let x = placement.x; x < placement.x + w; x++) for (let y = placement.y; y < placement.y + d; y++) {
      const key = `${x},${y}`
      if (x < 0 || y < 0 || x >= size || y >= size || !isLand(x, y)) onLand = false
      if (occupied.has(key)) free = false
      cells.push(key)
    }
    if (!onLand || (!free && resized(item.id))) displaced.push(placement.id)
    else cells.forEach(cell => occupied.add(cell))
  }
  return displaced
}
