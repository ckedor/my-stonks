import '@xyflow/react/dist/style.css'

import { useMemo } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type NodeTypes,
} from '@xyflow/react'
import { Alert, Box, Typography, useTheme } from '@mui/material'

import {
  architectureEdges,
  architectureNodes,
  validateArchitectureMap,
} from './graph/architecture-map'
import { layoutArchitectureGraph } from './graph/layout'
import ArchitectureNode from './nodes/ArchitectureNode'

const nodeTypes: NodeTypes = { architecture: ArchitectureNode }

export default function ArchitecturePage() {
  const theme = useTheme()
  const errors = useMemo(() => validateArchitectureMap(), [])
  const nodes = useMemo(
    () => layoutArchitectureGraph(architectureNodes, architectureEdges),
    [],
  )
  const edges = useMemo(
    () => architectureEdges.map((edge) => ({
      ...edge,
      markerEnd: { type: MarkerType.ArrowClosed, color: theme.palette.text.secondary },
      style: { stroke: theme.palette.text.secondary, strokeWidth: 1.25 },
      labelStyle: { fill: theme.palette.text.secondary, fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: theme.palette.background.default, fillOpacity: 0.92 },
    })),
    [theme],
  )

  if (errors.length) return <Alert severity="error">{errors.join('; ')}</Alert>

  return (
    <Box sx={{ height: 'calc(100vh - 108px)', minHeight: 620, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h5" fontWeight={700}>Arquitetura da aplicação</Typography>
        <Typography variant="body2" color="text.secondary">
          Mapa conceitual dos principais fluxos operacionais. Os dados são estáticos e versionados com o frontend.
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.25}
          maxZoom={1.8}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background color={theme.palette.divider} gap={24} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(item) => accentForMinimap(item.data?.kind)}
            maskColor={theme.palette.mode === 'dark' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.72)'}
          />
        </ReactFlow>
      </Box>
    </Box>
  )
}

function accentForMinimap(kind: unknown): string {
  const colors: Record<string, string> = {
    scheduler: '#7c5ce5', task: '#3f7cac', module: '#8b5e34', service: '#27896f',
    database: '#b66a2c', cache: '#b33f62', external: '#68717d',
  }
  return colors[String(kind)] ?? '#68717d'
}
