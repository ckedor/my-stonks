import { useState } from 'react'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded'
import { AppChip, AppPageHeader, AppStack, AppTabs, AppText } from '@/components/ui'
import BriefingProposal from './BriefingProposal'
import RadarProposal from './RadarProposal'
import { DetailDrawer, QuoteStrip } from './MarketPieces'
import type { Detail } from './mockData'
import BrazilView from './brazil/BrazilView'
import WorldView from './world/WorldView'

/* Mundo e Brasil são as abas de verdade. Briefing e Radar são os mocks que ficam como
   referência visual enquanto ela cresce, e por isso só eles carregam o aviso
   de dado fictício. */
const TABS = [
  { id: 'world', label: 'Mundo', icon: <PublicOutlinedIcon fontSize="small" /> },
  { id: 'brazil', label: 'Brasil', icon: <ShowChartRoundedIcon fontSize="small" /> },
  { id: 'briefing', label: 'Briefing · mock', icon: <ArticleOutlinedIcon fontSize="small" /> },
  { id: 'radar', label: 'Radar · mock', icon: <GridViewOutlinedIcon fontSize="small" /> },
]

export default function MarketOverviewTabsPage() {
  const [tab, setTab] = useState('world')
  const [detail, setDetail] = useState<Detail | null>(null)
  const isMock = tab === 'briefing' || tab === 'radar'
  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Visão geral"
        actions={
          isMock ? (
            <AppChip label="MOCK · Maio 2026" tone="neutral" emphasis="outline" />
          ) : undefined
        }
      />
      <AppStack gap="sm">
        <AppTabs items={TABS} value={tab} onChange={setTab} label="Visão geral do mercado" />
        {isMock && (
          <AppStack direction="row" justify="between" gap="sm" wrap>
            <AppText variant="bodySmall" tone="secondary">
              {tab === 'briefing'
                ? 'Uma leitura guiada: o essencial primeiro, o contexto a um clique.'
                : 'Uma visão para explorar: compare mercados e siga as conexões.'}
            </AppText>
            <AppText variant="caption" tone="secondary">
              Edição fictícia · cotações, notícias e projeções ilustrativas
            </AppText>
          </AppStack>
        )}
      </AppStack>
      {tab === 'world' && <WorldView />}
      {tab === 'brazil' && <BrazilView />}
      {isMock && (
        <>
          <QuoteStrip onOpen={setDetail} />
          {tab === 'briefing' ? (
            <BriefingProposal onOpen={setDetail} />
          ) : (
            <RadarProposal onOpen={setDetail} />
          )}
          <AppText variant="caption" tone="secondary">
            Mock de produto · Maio de 2026. Os dados e as trajetórias são demonstrativos, sem
            atualização em tempo real.
          </AppText>
          <DetailDrawer detail={detail} onClose={() => setDetail(null)} />
        </>
      )}
    </AppStack>
  )
}
