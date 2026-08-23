import { AppCard, AppStack, AppTable, AppTabs, AppText, PageTitle, SectionTitle } from '@/components/ui'
import { useState } from 'react'
import ChartsTab from './ChartsTab'
import GeneralTab from './GeneralTab'
import { MOCK_TABLE_COLUMNS, MOCK_TABLE_ROWS, MOCK_TABLE_TOTAL } from './mockData'

type DesignSystemTab = 'general' | 'charts' | 'table'

const TABS = [
  { id: 'general' as const, label: 'General' },
  { id: 'charts' as const, label: 'Charts' },
  { id: 'table' as const, label: 'Data Table' },
]

export default function DesignSystemPage() {
  const [tab, setTab] = useState<DesignSystemTab>('general')

  return (
    <AppStack gap="lg">
      <PageTitle>Design System</PageTitle>

      <AppTabs items={TABS} value={tab} onChange={setTab} label="Seções do design system" />

      {tab === 'general' && <GeneralTab />}
      {tab === 'charts' && <ChartsTab />}
      {tab === 'table' && (
        <AppCard>
          <AppStack gap="sm">
            <AppStack gap="none">
              <SectionTitle>AppTable</SectionTitle>
              <AppText variant="bodySmall" tone="secondary">
                Sortable table with currency formatting and gain/loss colors
              </AppText>
            </AppStack>
            <AppTable
              columns={MOCK_TABLE_COLUMNS}
              rows={MOCK_TABLE_ROWS}
              totalRow={MOCK_TABLE_TOTAL}
              size="small"
            />
          </AppStack>
        </AppCard>
      )}
    </AppStack>
  )
}
