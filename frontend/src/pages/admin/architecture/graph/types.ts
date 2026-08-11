import type { Edge, Node } from '@xyflow/react'

export type ArchitectureNodeKind =
  | 'scheduler'
  | 'task'
  | 'module'
  | 'service'
  | 'database'
  | 'cache'
  | 'external'

export type ArchitectureRelation =
  | 'triggers'
  | 'calls'
  | 'reads'
  | 'writes'
  | 'reads/writes'
  | 'caches'
  | 'invalidates'
  | 'publishes'
  | 'consumes'

export type ArchitectureNodeData = {
  kind: ArchitectureNodeKind
  title: string
  subtitle?: string
  details?: string[]
}

export type ArchitectureNode = Node<ArchitectureNodeData>
export type ArchitectureEdge = Edge<{ relation: ArchitectureRelation }>
