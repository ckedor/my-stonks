import { AppSidebar } from '@/components/ui'

import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import BusinessIcon from '@mui/icons-material/Business'
import CalculateIcon from '@mui/icons-material/Calculate'
import EventIcon from '@mui/icons-material/Event'
import PaletteIcon from '@mui/icons-material/Palette'
import PeopleIcon from '@mui/icons-material/People'
import PsychologyIcon from '@mui/icons-material/Psychology'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import TableChartIcon from '@mui/icons-material/TableChart'
import TokenIcon from '@mui/icons-material/Token'

import { useLocation, useNavigate } from 'react-router-dom'

import { getAdminNavigationSection } from './navigation'

const menuIcons: Record<string, React.ReactNode> = {
  '/admin/assets': <TokenIcon fontSize="small" />,
  '/admin/brokers': <BusinessIcon fontSize="small" />,
  '/admin/events': <EventIcon fontSize="small" />,
  '/admin/market-data/usd-brl': <AttachMoneyIcon fontSize="small" />,
  '/admin/market-data/series': <ShowChartIcon fontSize="small" />,
  '/admin/market-data/quotes': <TableChartIcon fontSize="small" />,
  '/admin/asset-sync': <SyncAltIcon fontSize="small" />,
  '/admin/quote-ingestion': <SyncAltIcon fontSize="small" />,
  '/admin/recommended-portfolios': <TokenIcon fontSize="small" />,
  '/admin/market-data-series-ingestion': <SyncAltIcon fontSize="small" />,
  '/admin/usd-brl-ingestion': <SyncAltIcon fontSize="small" />,
  '/admin/consolidation': <CalculateIcon fontSize="small" />,
  '/admin/users': <PeopleIcon fontSize="small" />,
  '/admin/ai-features': <PsychologyIcon fontSize="small" />,
  '/admin/design-system': <PaletteIcon fontSize="small" />,
}

export default function AdminSidebar({
  variant,
  open,
  onClose,
}: {
  variant: 'permanent' | 'persistent'
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = getAdminNavigationSection(pathname)

  return (
    <AppSidebar
      title="Admin Panel"
      items={section.items.map((item) => ({
        path: item.path,
        label: item.label,
        icon: menuIcons[item.path],
      }))}
      selectedPath={pathname}
      onNavigate={navigate}
      variant={variant}
      open={open}
      onClose={onClose}
    />
  )
}
