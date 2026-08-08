import { describe, expect, it } from 'vitest'

import {
  architectureEdges,
  architectureNodes,
  validateArchitectureMap,
} from './architecture-map'
import { layoutArchitectureGraph } from './layout'

describe('architecture map', () => {
  it('contains valid endpoints and the required high-level node kinds', () => {
    expect(validateArchitectureMap()).toEqual([])
    expect(new Set(architectureNodes.map((item) => item.data.kind))).toEqual(
      new Set(['scheduler', 'task', 'module', 'service', 'database', 'cache', 'external']),
    )
  })

  it('uses Dagre to create finite positions without mutating the static map', () => {
    const originalPositions = architectureNodes.map((item) => item.position)
    const layout = layoutArchitectureGraph(architectureNodes, architectureEdges)

    expect(layout).toHaveLength(architectureNodes.length)
    expect(layout.every((item) => Number.isFinite(item.position.x) && Number.isFinite(item.position.y))).toBe(true)
    expect(layout.some((item) => item.position.x !== 0 || item.position.y !== 0)).toBe(true)
    expect(architectureNodes.map((item) => item.position)).toEqual(originalPositions)
  })
})
