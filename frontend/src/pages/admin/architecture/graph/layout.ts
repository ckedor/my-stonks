import dagre from '@dagrejs/dagre'
import { Position } from '@xyflow/react'

import type { ArchitectureEdge, ArchitectureNode } from './types'

const NODE_WIDTH = 220
const NODE_HEIGHT = 104

export function layoutArchitectureGraph(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
): ArchitectureNode[] {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 34, edgesep: 20 })

  for (const item of nodes) graph.setNode(item.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  for (const item of edges) graph.setEdge(item.source, item.target)
  dagre.layout(graph)

  return nodes.map((item) => {
    const position = graph.node(item.id)
    return {
      ...item,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    }
  })
}
