import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import ApartmentIcon from '@mui/icons-material/Apartment'
import BalanceIcon from '@mui/icons-material/Balance'
import CategoryIcon from '@mui/icons-material/Category'
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin'
import DashboardIcon from '@mui/icons-material/Dashboard'
import DonutSmallIcon from '@mui/icons-material/DonutSmall'
import LayersIcon from '@mui/icons-material/Layers'
import ManageSearchIcon from '@mui/icons-material/ManageSearch'
import PaidIcon from '@mui/icons-material/Paid'
import PublicIcon from '@mui/icons-material/Public'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import SpeedIcon from '@mui/icons-material/Speed'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import TokenIcon from '@mui/icons-material/Token'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import type { ReactNode } from 'react'

/* Ícone de cada destino da navegação.
 *
 * Fica fora de `navigation.ts` porque aquele arquivo é dado puro e testado
 * como dado; e fora do `AppNavRail` porque o design system não conhece rota.
 * É o mesmo arranjo do admin (`pages/admin/Sidebar.tsx`).
 *
 * Não é decoração: recolhida, a coluna é só ícone, então um destino sem
 * ícone fica sem rótulo nenhum. Por isso há um padrão, e não um espaço
 * vazio, para as rotas que nascem dos dados do usuário. */

const NAVIGATION_ICONS: Record<string, ReactNode> = {
  '/portfolio/overview': <DashboardIcon />,
  '/portfolio/asset': <TokenIcon />,
  '/portfolio/category': <CategoryIcon />,
  '/portfolio/distribution': <DonutSmallIcon />,
  '/portfolio/wealth': <AccountBalanceIcon />,
  '/portfolio/returns': <TrendingUpIcon />,
  '/portfolio/analysis': <SpeedIcon />,
  '/portfolio/rebalancing': <BalanceIcon />,
  '/portfolio/fii': <ApartmentIcon />,
  '/portfolio/trades': <SwapHorizIcon />,
  '/portfolio/dividends': <PaidIcon />,
  '/portfolio/tax-income': <ReceiptLongIcon />,
  '/market/overview': <PublicIcon />,
  '/market/assets': <ManageSearchIcon />,
  '/market/stock': <ShowChartIcon />,
  '/market/etf': <LayersIcon />,
  '/market/fii': <ApartmentIcon />,
  '/market/crypto': <CurrencyBitcoinIcon />,
}

/** Os ativos mais visitados são a única entrada montada a partir dos dados
 *  do usuário — uma rota por ativo, que não dá para listar aqui. */
export function getNavigationIcon(path: string): ReactNode {
  return NAVIGATION_ICONS[path] ?? <StarBorderIcon />
}
