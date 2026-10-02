import PsychologyIcon from '@mui/icons-material/Psychology'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import { AppSidebar } from '@/components/ui'

import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import BarChartIcon from '@mui/icons-material/BarChart'
import BrushIcon from '@mui/icons-material/Brush'
import BusinessIcon from '@mui/icons-material/Business'
import CalculateIcon from '@mui/icons-material/Calculate'
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart'
import DashboardIcon from '@mui/icons-material/Dashboard'
import EditNoteIcon from '@mui/icons-material/EditNote'
import EventIcon from '@mui/icons-material/Event'
import HistoryIcon from '@mui/icons-material/History'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import LayersIcon from '@mui/icons-material/Layers'
import LinkIcon from '@mui/icons-material/Link'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import NumbersIcon from '@mui/icons-material/Numbers'
import PaletteIcon from '@mui/icons-material/Palette'
import PeopleIcon from '@mui/icons-material/People'
import PieChartIcon from '@mui/icons-material/PieChart'
import PriceChangeIcon from '@mui/icons-material/PriceChange'
import PublicIcon from '@mui/icons-material/Public'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import TableChartIcon from '@mui/icons-material/TableChart'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import ToggleOnIcon from '@mui/icons-material/ToggleOn'
import TokenIcon from '@mui/icons-material/Token'
import TouchAppIcon from '@mui/icons-material/TouchApp'

import { useLocation, useNavigate } from 'react-router-dom'

import {
  DESIGN_SYSTEM_FAMILIES,
  designSystemFamilyPath,
  THEME_STUDIO_PATH,
  type DesignSystemFamilySlug,
} from './design-system/families'
import { getAdminNavigationSection, INTEGRATIONS_PATH } from './navigation'

/* Um ícone por família do catálogo. O `Record` é o que obriga a família nova
 * a chegar ao menu com o dela. */
const designSystemIcons: Record<DesignSystemFamilySlug, React.ReactNode> = {
  fundamentos: <PaletteIcon fontSize="small" />,
  texto: <TextFieldsIcon fontSize="small" />,
  acoes: <TouchAppIcon fontSize="small" />,
  escolha: <ToggleOnIcon fontSize="small" />,
  campos: <EditNoteIcon fontSize="small" />,
  feedback: <NotificationsNoneIcon fontSize="small" />,
  espera: <HourglassEmptyIcon fontSize="small" />,
  numeros: <NumbersIcon fontSize="small" />,
  tabelas: <TableChartIcon fontSize="small" />,
  superficies: <LayersIcon fontSize="small" />,
  graficos: <BarChartIcon fontSize="small" />,
}

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
  ...Object.fromEntries(
    DESIGN_SYSTEM_FAMILIES.map((family) => [
      designSystemFamilyPath(family.slug),
      designSystemIcons[family.slug],
    ]),
  ),
  [THEME_STUDIO_PATH]: <BrushIcon fontSize="small" />,
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
        group: item.group,
      }))}
      selectedPath={pathname}
      onNavigate={navigate}
      variant={variant}
      open={open}
      onClose={onClose}
    />
  )
}
