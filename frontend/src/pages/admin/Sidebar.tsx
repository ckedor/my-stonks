import PsychologyIcon from '@mui/icons-material/Psychology'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import { AppNavRail, type AppNavRailGroup } from '@/components/ui'

import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import BusinessIcon from '@mui/icons-material/Business'
import CalculateIcon from '@mui/icons-material/Calculate'
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart'
import DashboardIcon from '@mui/icons-material/Dashboard'
import EventIcon from '@mui/icons-material/Event'
import HistoryIcon from '@mui/icons-material/History'
import LinkIcon from '@mui/icons-material/Link'
import PeopleIcon from '@mui/icons-material/People'
import PieChartIcon from '@mui/icons-material/PieChart'
import PriceChangeIcon from '@mui/icons-material/PriceChange'
import PublicIcon from '@mui/icons-material/Public'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import TableChartIcon from '@mui/icons-material/TableChart'
import TokenIcon from '@mui/icons-material/Token'

import { useLocation, useNavigate } from 'react-router-dom'

import {
  getActiveAdminPath,
  getAdminNavigationSection,
  groupAdminItems,
  INTEGRATIONS_PATH,
} from './navigation'

const menuIcons: Record<string, React.ReactNode> = {
  [INTEGRATIONS_PATH]: <DashboardIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/runs`]: <HistoryIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/quotes`]: <CandlestickChartIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/market-series`]: <ShowChartIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/usd-brl`]: <AttachMoneyIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/fund-share-values`]: <PriceChangeIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/etf-holdings`]: <PieChartIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/fund-registry`]: <AccountBalanceIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/etf-registry`]: <PublicIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/asset-catalogue`]: <SyncAltIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/company-registry`]: <BusinessIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/fund-links`]: <LinkIcon fontSize="small" />,
  [`${INTEGRATIONS_PATH}/consolidation`]: <CalculateIcon fontSize="small" />,
  '/admin/ai-features': <PsychologyIcon fontSize="small" />,
  '/admin/ai-usage': <ReceiptLongIcon fontSize="small" />,
  '/admin/assets': <TokenIcon fontSize="small" />,
  '/admin/brokers': <BusinessIcon fontSize="small" />,
  '/admin/events': <EventIcon fontSize="small" />,
  '/admin/market-data/usd-brl': <AttachMoneyIcon fontSize="small" />,
  '/admin/market-data/series': <ShowChartIcon fontSize="small" />,
  '/admin/market-data/quotes': <TableChartIcon fontSize="small" />,
  '/admin/recommended-portfolios': <TokenIcon fontSize="small" />,
  '/admin/users': <PeopleIcon fontSize="small" />,
}

export default function AdminSidebar({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = getAdminNavigationSection(pathname)

  const activePath = getActiveAdminPath(section, pathname)

  const groups: AppNavRailGroup[] = groupAdminItems(section).map((group) => ({
    title: group.title,
    items: group.items.map((item) => ({
      id: item.path,
      label: item.label,
      icon: menuIcons[item.path],
      active: item.path === activePath,
    })),
  }))

  return (
    <AppNavRail
      navLabel={`Páginas de ${section.label}`}
      collapsed={collapsed}
      groups={groups}
      onSelect={(path) => navigate(path)}
    />
  )
}
