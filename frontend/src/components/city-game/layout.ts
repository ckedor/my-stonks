import { isoPieceSize, type IsoBuilderItem, type IsoBuilderPlacement } from '@/components/ui'
import { parseAssetBuildingId } from './asset-buildings'

/** Bumped whenever an asset's footprint can change — the enlarged monument
 *  scale, the FII tortoise. A saved city is reconciled once on opening. */
export const ASSET_LAYOUT_REVISION = 20

/** Decorations stay where the player put them. Enlarged assets that no
 * longer fit go to the existing pending tray, preserving the holding and
 * finish rather than silently overlapping another piece or the shore. */
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
    let fits = true
    for (let x = placement.x; x < placement.x + w; x++) for (let y = placement.y; y < placement.y + d; y++) {
      const key = `${x},${y}`
      if (occupied.has(key) || x < 0 || y < 0 || x >= size || y >= size || !isLand(x, y)) fits = false
      cells.push(key)
    }
    if (!fits && resized(item.id)) displaced.push(placement.id)
    else cells.forEach(cell => occupied.add(cell))
  }
  return displaced
}
