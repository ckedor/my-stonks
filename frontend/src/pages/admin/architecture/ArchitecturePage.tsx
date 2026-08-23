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
import {
  AppAlert,
  AppBulletList,
  AppCard,
  AppChip,
  AppDivider,
  AppStack,
  AppStackItem,
  AppStepBadge,
  AppTabs,
  AppText,
  PageTitle,
  SectionTitle,
  useAppTheme,
} from '@/components/ui'

import { flows, moduleRules } from './flows'
import {
  architectureEdges,
  architectureNodes,
  validateArchitectureMap,
} from './graph/architecture-map'
import { layoutArchitectureGraph } from './graph/layout'
import ArchitectureNode from './nodes/ArchitectureNode'

const nodeTypes: NodeTypes = { architecture: ArchitectureNode }

/* Ocupa o que sobra da janela abaixo do cabeçalho e das abas: o diagrama é a
   tela, e um retângulo de altura fixa deixaria faixa vazia embaixo. */
const DIAGRAM_HEIGHT = 'max(520px, calc(100vh - 220px))'

function Diagram() {
  const theme = useAppTheme()
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
    <AppCard padding="none" height={DIAGRAM_HEIGHT}>
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
    </AppCard>
  )
}

function Flows() {
  return (
    <AppStack gap="md">
      {flows.map((flow) => (
        <AppCard key={flow.id}>
          <AppStack gap="md">
            <AppStack gap="xs">
              <AppStack direction="row" gap="sm" align="baseline" wrap>
                <SectionTitle>{flow.name}</SectionTitle>
                <AppChip label={flow.trigger} emphasis="outline" />
              </AppStack>
              <AppText variant="bodySmall" tone="secondary">
                {flow.summary}
              </AppText>
            </AppStack>

            <AppStack gap="sm">
              {flow.steps.map((step, index) => (
                <AppStack key={step.title} direction="row" gap="sm" align="start">
                  <AppStepBadge step={index + 1} />
                  <AppStackItem>
                    <AppText variant="bodySmall" weight="strong">
                      {step.title}
                    </AppText>
                    <AppText variant="bodySmall" tone="secondary">
                      {step.detail}
                    </AppText>
                  </AppStackItem>
                </AppStack>
              ))}
            </AppStack>

            {flow.notes?.length ? (
              <>
                <AppDivider />
                <AppStack gap="xs">
                  {flow.notes.map((note) => (
                    <AppText key={note} variant="caption" tone="secondary">
                      — {note}
                    </AppText>
                  ))}
                </AppStack>
              </>
            ) : null}
          </AppStack>
        </AppCard>
      ))}
    </AppStack>
  )
}

function Modules() {
  return (
    <AppStack gap="md">
      {moduleRules.map((module) => (
        <AppCard key={module.name}>
          <AppStack gap="sm">
            <AppStack gap="none">
              <SectionTitle>{module.name}</SectionTitle>
              <AppText variant="bodySmall" tone="secondary">
                {module.role}
              </AppText>
            </AppStack>
            <AppBulletList items={module.rules} />
          </AppStack>
        </AppCard>
      ))}
    </AppStack>
  )
}

type ArchitectureTab = 'diagram' | 'flows' | 'modules'

const TABS = [
  { id: 'diagram' as const, label: 'Diagrama' },
  { id: 'flows' as const, label: 'Fluxos' },
  { id: 'modules' as const, label: 'Módulos' },
]

export default function ArchitecturePage() {
  const errors = useMemo(() => validateArchitectureMap(), [])
  const [tab, setTab] = useState<ArchitectureTab>('diagram')

  if (errors.length) return <AppAlert severity="error">{errors.join('; ')}</AppAlert>

  return (
    <AppStack gap="md">
      <AppStack gap="xs">
        <PageTitle>Arquitetura da aplicação</PageTitle>
        <AppText variant="bodySmall" tone="secondary">
          Mapa e regras dos fluxos operacionais. É documentação versionada com o frontend, não
          introspecção em tempo real — ao mudar um fluxo, atualize aqui.
        </AppText>
      </AppStack>

      <AppTabs items={TABS} value={tab} onChange={setTab} label="Seções da arquitetura" />

      {tab === 'diagram' && <Diagram />}
      {tab === 'flows' && <Flows />}
      {tab === 'modules' && <Modules />}
    </AppStack>
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
