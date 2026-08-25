import { Handle, Position, type NodeProps } from '@xyflow/react'

import { AppCard, AppStack, AppText } from '@/components/ui'

import type { ArchitectureNode as ArchitectureNodeType } from '../graph/types'

const accentByKind = {
  scheduler: '#7c5ce5',
  task: '#3f7cac',
  module: '#8b5e34',
  service: '#27896f',
  database: '#b66a2c',
  cache: '#b33f62',
  external: '#68717d',
} as const

const NODE_WIDTH = 220

/* As pontas de ligação ficam invisíveis por `src/index.css`: o mapa não é
   editável, e o que liga um nó ao outro é a seta desenhada entre eles. */

export default function ArchitectureNode({ data }: NodeProps<ArchitectureNodeType>) {
  const accent = accentByKind[data.kind]

  return (
    <AppCard padding="sm" minWidth={NODE_WIDTH} accentEdge={accent} accentSide="left" raised>
      <Handle type="target" position={Position.Left} />

      <AppStack gap="none">
        <AppText variant="bodySmall" weight="strong">
          {data.title}
        </AppText>
        <AppText variant="caption" weight="strong" tint={accent}>
          {data.subtitle ?? data.kind.toUpperCase()}
        </AppText>
        {data.details?.map((detail) => (
          <AppText key={detail} variant="caption" tone="secondary">
            {detail}
          </AppText>
        ))}
      </AppStack>

      <Handle type="source" position={Position.Right} />
    </AppCard>
  )
}
