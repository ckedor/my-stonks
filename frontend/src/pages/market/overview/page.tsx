import { useState } from 'react'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import { AppChip, AppPageHeader, AppStack, AppTabs, AppText } from '@/components/ui'
import BriefingProposal from './BriefingProposal'
import RadarProposal from './RadarProposal'
import { DetailDrawer, QuoteStrip } from './MarketPieces'
import type { Detail } from './mockData'

const PROPOSALS = [
  { id: 'briefing', label: '01 · O briefing', icon: <ArticleOutlinedIcon fontSize="small" /> },
  { id: 'radar', label: '02 · O radar', icon: <GridViewOutlinedIcon fontSize="small" /> },
]

export default function MarketOverviewTabsPage() {
  const [proposal, setProposal] = useState('briefing')
  const [detail, setDetail] = useState<Detail | null>(null)
  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Visão geral"
        actions={<AppChip label="MOCK · Maio 2026" tone="neutral" emphasis="outline" />}
      />
      <AppStack gap="sm">
        <AppTabs
          items={PROPOSALS}
          value={proposal}
          onChange={setProposal}
          label="Proposta de visão geral do mercado"
        />
        <AppStack direction="row" justify="between" gap="sm" wrap>
          <AppText variant="bodySmall" tone="secondary">
            {proposal === 'briefing'
              ? 'Uma leitura guiada: o essencial primeiro, o contexto a um clique.'
              : 'Uma visão para explorar: compare mercados e siga as conexões.'}
          </AppText>
          <AppText variant="caption" tone="secondary">
            Edição fictícia · cotações, notícias e projeções ilustrativas
          </AppText>
        </AppStack>
      </AppStack>
      <QuoteStrip onOpen={setDetail} />
      {proposal === 'briefing' ? (
        <BriefingProposal onOpen={setDetail} />
      ) : (
        <RadarProposal onOpen={setDetail} />
      )}
      <AppText variant="caption" tone="secondary">
        Mock de produto · Maio de 2026. Os dados e as trajetórias são demonstrativos, sem
        atualização em tempo real.
      </AppText>
      <DetailDrawer detail={detail} onClose={() => setDetail(null)} />
    </AppStack>
  )
}
