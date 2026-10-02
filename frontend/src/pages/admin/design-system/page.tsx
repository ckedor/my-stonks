import { AppStack, AppTabs, PageTitle } from '@/components/ui'
import { useState } from 'react'
import ChartsTab from './ChartsTab'
import GeneralTab from './GeneralTab'

type DesignSystemTab = 'general' | 'charts'

const TABS = [
  { id: 'general' as const, label: 'General' },
  { id: 'charts' as const, label: 'Charts' },
]

export default function DesignSystemPage() {
  const [tab, setTab] = useState<DesignSystemTab>('general')

  return (
    <AppStack gap="lg">
      <PageTitle>Design System</PageTitle>

      <AppTabs items={TABS} value={tab} onChange={setTab} label="Seções do design system" />

      {tab === 'general' && <GeneralTab />}
      {tab === 'charts' && <ChartsTab />}
    </AppStack>
  )
}
