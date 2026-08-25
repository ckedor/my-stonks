import { AppStack, AppTabs, PageTitle } from '@/components/ui'
import BrushIcon from '@mui/icons-material/Brush'
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions'
import { useState } from 'react'
import IntegrationsTab from './IntegrationsTab'
import ThemeTab from './ThemeTab'

type ConfigTab = 'appearance' | 'integrations'

const TABS = [
  { id: 'appearance' as const, label: 'Aparência', icon: <BrushIcon /> },
  { id: 'integrations' as const, label: 'Integrações', icon: <IntegrationInstructionsIcon /> },
]

export default function UserConfigurationPage() {
  const [tab, setTab] = useState<ConfigTab>('appearance')

  return (
    <AppStack gap="lg">
      <PageTitle>Configurações</PageTitle>

      <AppTabs items={TABS} value={tab} onChange={setTab} label="Seções das configurações" />

      {tab === 'appearance' && <ThemeTab />}
      {tab === 'integrations' && <IntegrationsTab />}
    </AppStack>
  )
}
