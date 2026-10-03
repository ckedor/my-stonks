import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router-dom'
import './App.css'
import { initAuth } from './actions/auth'
import MainLayout from './layouts/MainLayout'
import AdminAssetsPage from './pages/admin/assets/page'
import AdminBrokersPage from './pages/admin/brokers/page'
import AdminEventsPage from './pages/admin/events/page'
import AdminAiFeaturesPage from './pages/admin/ai-features/page'
import AdminAiFeatureDetailPage from './pages/admin/ai-features/[key]/page'
import AdminAiUsagePage from './pages/admin/ai-usage/page'
import AdminRecommendedPortfoliosPage from './pages/admin/recommended-portfolios/page'
import AdminMarketDataQuotesPage from './pages/admin/market-data/quotes/page'
import AdminMarketDataSeriesPage from './pages/admin/market-data/series/page'
import AdminMarketDataUsdBrlPage from './pages/admin/market-data/usd-brl/page'
import AdminLayout from './pages/admin/layout'
import AdminIntegrationsPage from './pages/admin/integrations/page'
import AdminAssetCataloguePage from './pages/admin/integrations/asset-catalogue/page'
import AdminCompanyRegistryPage from './pages/admin/integrations/company-registry/page'
import AdminConsolidationPage from './pages/admin/integrations/consolidation/page'
import AdminEtfHoldingsIngestionPage from './pages/admin/integrations/etf-holdings/page'
import AdminEtfRegistryIngestionPage from './pages/admin/integrations/etf-registry/page'
import AdminFundLinksPage from './pages/admin/integrations/fund-links/page'
import AdminFundRegistryIngestionPage from './pages/admin/integrations/fund-registry/page'
import AdminFundShareValueIngestionPage from './pages/admin/integrations/fund-share-values/page'
import AdminMarketDataSeriesIngestionPage from './pages/admin/integrations/market-series/page'
import AdminQuoteIngestionPage from './pages/admin/integrations/quotes/page'
import AdminTaskRunsPage from './pages/admin/integrations/runs/page'
import AdminUsdBrlIngestionPage from './pages/admin/integrations/usd-brl/page'
import AdminUsersPage from './pages/admin/users/page'
import GameSandboxPage from './pages/admin/game/sandbox/page'
import LoginPage from './pages/login'
import MarketAssetPage from './pages/market/asset/page'
import MarketAtivosPage from './pages/market/ativos/page'
import PensionPage from './pages/portfolio/pension/page'
import MarketCataloguePage from './pages/market/catalogue/page'
import MarketFIIPage from './pages/market/fii/page'
import MarketInvestmentFundPage from './pages/market/investment-fund/page'
import MarketLaboratoryPage from './pages/market/laboratory/page'
import MarketLaboratoryComparePage from './pages/market/laboratory/compare/page'
import MarketOverviewPage from './pages/market/overview/page'
import MarketSeriesPage from './pages/market/series/page'
import MarketUsdBrlPage from './pages/market/usd-brl/page'
import PortfolioAssetsPage from './pages/portfolio/asset'
import PortfolioAssetPage from './pages/portfolio/asset/[id]/page'
import PortfolioCategoryPage from './pages/portfolio/category/page'
import CityPage from './pages/portfolio/city/page'
import DistributionPage from './pages/portfolio/distribution/page'
import PortfolioDocumentsPage from './pages/portfolio/documents/page'
import PortfolioDividendsPage from './pages/portfolio/dividends/page'
import PortfolioSegmentPage from './pages/portfolio/segment/page'
import PortfolioOverviewPage from './pages/portfolio/overview'
import PortfolioReturnsPage from './pages/portfolio/returns/page'
import PortfolioRiskPage from './pages/portfolio/risk/page'
import TaxIncomePage from './pages/portfolio/tax-income/page'
import PortfolioTransactionsPage from './pages/portfolio/trades/page'
import UserConfigurationPage from './pages/portfolio/user-configurations/page'
import PortfolioPatrimonyEvolution from './pages/portfolio/wealth/page'
import { ThemeRegistry } from './theme'

/* Ferramentas de desenvolvimento: o catálogo do design system e o estúdio de
   temas. Só existem com `npm run dev` — o build de produção troca
   `import.meta.env.DEV` por `false`, descarta este ramo e, com ele, os
   imports sob demanda, de modo que nenhum chunk daqui é gerado. A regressão
   visual roda contra o dev server e as alcança. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev',
        children: [
          { index: true, element: <Navigate to="/dev/design-system" replace /> },
          /* Fora da rota-mãe: o estúdio monta a casca sob o tema em edição. */
          {
            path: 'design-system/temas',
            lazy: async () => ({ Component: (await import('./pages/dev/theme-studio/page')).default }),
          },
          {
            lazy: async () => ({ Component: (await import('./pages/dev/layout')).default }),
            children: [
              {
                path: 'design-system/:family?',
                lazy: async () => ({ Component: (await import('./pages/dev/design-system/page')).default }),
              },
            ],
          },
        ],
      },
    ]
  : []

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/portfolio/overview" replace /> },
      { path: 'portfolio/overview', element: <PortfolioOverviewPage /> },
      { path: 'portfolio/asset', element: <PortfolioAssetsPage /> },
      { path: 'portfolio/asset/:id', element: <PortfolioAssetPage /> },
      { path: 'portfolio/category', element: <PortfolioCategoryPage /> },
      { path: 'portfolio/category/:id', element: <PortfolioCategoryPage /> },
      { path: 'portfolio/city', element: <CityPage /> },
      { path: 'portfolio/distribution', element: <DistributionPage /> },
      { path: 'portfolio/dividends', element: <PortfolioDividendsPage /> },
      { path: 'portfolio/fii', element: <PortfolioSegmentPage segment="fii" /> },
      { path: 'portfolio/equity-br', element: <PortfolioSegmentPage segment="equity-br" /> },
      { path: 'portfolio/equity-world', element: <PortfolioSegmentPage segment="equity-world" /> },
      { path: 'portfolio/fixed-income', element: <PortfolioSegmentPage segment="fixed-income" /> },
      { path: 'portfolio/crypto', element: <PortfolioSegmentPage segment="crypto" /> },
      { path: 'portfolio/investment-fund', element: <PortfolioSegmentPage segment="investment-fund" /> },
      { path: 'portfolio/returns', element: <PortfolioReturnsPage /> },
      { path: 'portfolio/analysis', element: <PortfolioRiskPage /> },
      { path: 'portfolio/pension', element: <PensionPage /> },
      { path: 'portfolio/tax-income', element: <TaxIncomePage /> },
      { path: 'portfolio/documents', element: <PortfolioDocumentsPage /> },
      { path: 'portfolio/trades', element: <PortfolioTransactionsPage /> },
      { path: 'portfolio/wealth', element: <PortfolioPatrimonyEvolution /> },
      // Distribuição e rebalanceamento viraram uma tela só; o link antigo
      // continua chegando nela.
      { path: 'portfolio/rebalancing', element: <Navigate to="/portfolio/distribution" replace /> },
      // O Construtor virou a Cidade.
      { path: 'portfolio/city-builder', element: <Navigate to="/portfolio/city" replace /> },
      // A Jornada do Herói virou a patente da visão geral.
      { path: 'portfolio/tiers', element: <Navigate to="/portfolio/overview" replace /> },
      { path: 'portfolio/user-configurations', element: <UserConfigurationPage /> },
      { path: 'market/assets', element: <MarketAtivosPage /> },
      { path: 'market/overview', element: <MarketOverviewPage /> },
      { path: 'market/series/:id', element: <MarketSeriesPage /> },
      { path: 'market/usd-brl', element: <MarketUsdBrlPage /> },
      { path: 'market/fii', element: <MarketFIIPage /> },
      { path: 'market/investment-fund', element: <MarketInvestmentFundPage /> },
      { path: 'market/br', element: <MarketCataloguePage market="br" /> },
      { path: 'market/us', element: <MarketCataloguePage market="us" /> },
      { path: 'market/crypto', element: <MarketCataloguePage market="crypto" /> },
      { path: 'market/laboratory', element: <MarketLaboratoryPage /> },
      { path: 'market/laboratory/compare', element: <MarketLaboratoryComparePage /> },
      { path: 'market/laboratory/:id', element: <MarketLaboratoryPage /> },
      { path: 'market/asset/:id', element: <MarketAssetPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { path: 'integrations', element: <AdminIntegrationsPage /> },
      { path: 'integrations/runs', element: <AdminTaskRunsPage /> },
      { path: 'integrations/quotes', element: <AdminQuoteIngestionPage /> },
      { path: 'integrations/market-series', element: <AdminMarketDataSeriesIngestionPage /> },
      { path: 'integrations/usd-brl', element: <AdminUsdBrlIngestionPage /> },
      { path: 'integrations/fund-share-values', element: <AdminFundShareValueIngestionPage /> },
      { path: 'integrations/fund-registry', element: <AdminFundRegistryIngestionPage /> },
      { path: 'integrations/etf-registry', element: <AdminEtfRegistryIngestionPage /> },
      { path: 'integrations/etf-holdings', element: <AdminEtfHoldingsIngestionPage /> },
      { path: 'integrations/asset-catalogue', element: <AdminAssetCataloguePage /> },
      { path: 'integrations/company-registry', element: <AdminCompanyRegistryPage /> },
      { path: 'integrations/fund-links', element: <AdminFundLinksPage /> },
      { path: 'integrations/consolidation', element: <AdminConsolidationPage /> },
      { path: 'assets', element: <AdminAssetsPage /> },
      { path: 'brokers', element: <AdminBrokersPage /> },
      { path: 'events', element: <AdminEventsPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'game/sandbox', element: <GameSandboxPage /> },
      { path: 'market-data/usd-brl', element: <AdminMarketDataUsdBrlPage /> },
      { path: 'market-data/series', element: <AdminMarketDataSeriesPage /> },
      { path: 'market-data/quotes', element: <AdminMarketDataQuotesPage /> },
      {
        path: 'ai-features',
        element: <AdminAiFeaturesPage />,
      },
      {
        path: 'ai-features/:key',
        element: <AdminAiFeatureDetailPage />,
      },
      {
        path: 'ai-usage',
        element: <AdminAiUsagePage />,
      },
      {
        path: 'recommended-portfolios',
        element: <AdminRecommendedPortfoliosPage />,
      },
      { index: true, element: <Navigate to="/admin/integrations" replace /> },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  ...devRoutes,
  {
    path: '/*',
    element: <div>404 Not Found</div>,
  },
])

// Initialize auth from cookie on app startup
initAuth()

function App() {
  return (
    <ThemeRegistry>
      <RouterProvider router={router} />
    </ThemeRegistry>
  )
}

export default App
