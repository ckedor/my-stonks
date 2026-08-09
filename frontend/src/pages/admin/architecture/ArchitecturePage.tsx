import '@xyflow/react/dist/style.css'

import { useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type NodeTypes,
} from '@xyflow/react'
import { Alert, Box, Chip, Divider, Paper, Stack, Tab, Tabs, Typography, useTheme } from '@mui/material'

import { flows, moduleRules } from './flows'
import {
  architectureEdges,
  architectureNodes,
  validateArchitectureMap,
} from './graph/architecture-map'
import { layoutArchitectureGraph } from './graph/layout'
import ArchitectureNode from './nodes/ArchitectureNode'

const nodeTypes: NodeTypes = { architecture: ArchitectureNode }

function Diagram() {
  const theme = useTheme()
  const nodes = useMemo(() => layoutArchitectureGraph(architectureNodes, architectureEdges), [])
  const edges = useMemo(
    () =>
      architectureEdges.map((edge) => ({
        ...edge,
        markerEnd: { type: MarkerType.ArrowClosed, color: theme.palette.text.secondary },
        style: { stroke: theme.palette.text.secondary, strokeWidth: 1.25 },
        labelStyle: { fill: theme.palette.text.secondary, fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: theme.palette.background.default, fillOpacity: 0.92 },
      })),
    [theme],
  )

  return (
    <Box
      sx={{
        height: 'calc(100vh - 220px)',
        minHeight: 520,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
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
  )
}

function Flows() {
  return (
    <Stack spacing={2.5}>
      {flows.map((flow) => (
        <Paper key={flow.id} variant="outlined" sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="baseline" flexWrap="wrap">
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {flow.name}
            </Typography>
            <Chip label={flow.trigger} size="small" variant="outlined" sx={{ fontSize: 11 }} />
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            {flow.summary}
          </Typography>

          <Stack spacing={1.5}>
            {flow.steps.map((step, index) => (
              <Stack key={step.title} direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {index + 1}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.detail}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>

          {flow.notes?.length ? (
            <>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={0.75}>
                {flow.notes.map((note) => (
                  <Typography key={note} variant="caption" color="text.secondary">
                    — {note}
                  </Typography>
                ))}
              </Stack>
            </>
          ) : null}
        </Paper>
      ))}
    </Stack>
  )
}

function Modules() {
  return (
    <Stack spacing={2.5}>
      {moduleRules.map((module) => (
        <Paper key={module.name} variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {module.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
            {module.role}
          </Typography>
          <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
            {module.rules.map((rule) => (
              <Typography key={rule} component="li" variant="body2" color="text.secondary">
                {rule}
              </Typography>
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}

export default function ArchitecturePage() {
  const errors = useMemo(() => validateArchitectureMap(), [])
  const [tab, setTab] = useState(0)

  if (errors.length) return <Alert severity="error">{errors.join('; ')}</Alert>

  return (
    <Box>
      <Typography variant="h5" fontWeight={700}>
        Arquitetura da aplicação
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Mapa e regras dos fluxos operacionais. É documentação versionada com o frontend, não
        introspecção em tempo real — ao mudar um fluxo, atualize aqui.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{ my: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Diagrama" />
        <Tab label="Fluxos" />
        <Tab label="Módulos" />
      </Tabs>

      {tab === 0 && <Diagram />}
      {tab === 1 && <Flows />}
      {tab === 2 && <Modules />}
    </Box>
  )
}

function accentForMinimap(kind: unknown): string {
  const colors: Record<string, string> = {
    scheduler: '#7c5ce5',
    task: '#3f7cac',
    module: '#8b5e34',
    service: '#27896f',
    database: '#b66a2c',
    cache: '#b33f62',
    external: '#68717d',
  }
  return colors[String(kind)] ?? '#68717d'
}
