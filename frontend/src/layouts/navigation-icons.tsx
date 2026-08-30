import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import ApartmentIcon from '@mui/icons-material/Apartment'
import BalanceIcon from '@mui/icons-material/Balance'
import CategoryIcon from '@mui/icons-material/Category'
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin'
import DashboardIcon from '@mui/icons-material/Dashboard'
import DonutSmallIcon from '@mui/icons-material/DonutSmall'
import LayersIcon from '@mui/icons-material/Layers'
import ManageSearchIcon from '@mui/icons-material/ManageSearch'
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech'
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
 * Não é decoração: o ícone é o que dá a leitura à distância numa lista de
 * quinze destinos. Por isso há um padrão, e não um espaço vazio, para as
 * rotas que nascem dos dados do usuário. */

const NAVIGATION_ICONS: Record<string, ReactNode> = {
  '/portfolio/overview': <DashboardIcon />,
  '/portfolio/asset': <TokenIcon />,
  '/portfolio/category': <CategoryIcon />,
  '/portfolio/distribution': <DonutSmallIcon />,
  '/portfolio/wealth': <AccountBalanceIcon />,
  '/portfolio/returns': <TrendingUpIcon />,
  '/portfolio/analysis': <SpeedIcon />,
  '/portfolio/fii': <ApartmentIcon />,
  '/portfolio/equity-br': <ShowChartIcon />,
  '/portfolio/equity-world': <PublicIcon />,
  '/portfolio/fixed-income': <BalanceIcon />,
  '/portfolio/crypto': <CurrencyBitcoinIcon />,
  '/portfolio/trades': <SwapHorizIcon />,
  '/portfolio/dividends': <PaidIcon />,
  '/portfolio/tax-income': <ReceiptLongIcon />,
  '/portfolio/tiers': <MilitaryTechIcon />,
  '/market/overview': <PublicIcon />,
  '/market/assets': <ManageSearchIcon />,
  '/market/stock': <ShowChartIcon />,
  '/market/etf': <LayersIcon />,
  '/market/fii': <ApartmentIcon />,
  '/market/crypto': <CurrencyBitcoinIcon />,
}

/** Os ativos mais visitados e as categorias da carteira são as entradas
 *  montadas a partir dos dados do usuário — uma rota por item, que não dá
 *  para listar aqui. A categoria tem ícone porque a rota dela é conhecida
 *  até o prefixo; o ativo cai na estrela. */
export function getNavigationIcon(path: string): ReactNode {
  if (path.startsWith('/portfolio/category/')) return <CategoryIcon />
  return NAVIGATION_ICONS[path] ?? <StarBorderIcon />
}
