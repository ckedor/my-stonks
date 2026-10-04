import { lazy, Suspense } from 'react'
import RouteSkeleton from './layouts/RouteSkeleton'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './App.css'
import { initAuth } from './actions/auth'
import MainLayout from './layouts/MainLayout'
import PortfolioOverviewPage from './pages/portfolio/overview'
import { ThemeRegistry } from './theme'

const AdminAssetsPage = lazy(() => import('./pages/admin/assets/page'))
const AdminBrokersPage = lazy(() => import('./pages/admin/brokers/page'))
const AdminEventsPage = lazy(() => import('./pages/admin/events/page'))
const AdminAiFeaturesPage = lazy(() => import('./pages/admin/ai-features/page'))
const AdminAiFeatureDetailPage = lazy(() => import('./pages/admin/ai-features/[key]/page'))
const AdminAiUsagePage = lazy(() => import('./pages/admin/ai-usage/page'))
const AdminRecommendedPortfoliosPage = lazy(() => import('./pages/admin/recommended-portfolios/page'))
const AdminMarketDataQuotesPage = lazy(() => import('./pages/admin/market-data/quotes/page'))
const AdminMarketDataSeriesPage = lazy(() => import('./pages/admin/market-data/series/page'))
const AdminMarketDataUsdBrlPage = lazy(() => import('./pages/admin/market-data/usd-brl/page'))
const AdminLayout = lazy(() => import('./pages/admin/layout'))
const AdminIntegrationsPage = lazy(() => import('./pages/admin/integrations/page'))
const AdminAssetCataloguePage = lazy(() => import('./pages/admin/integrations/asset-catalogue/page'))
const AdminCompanyRegistryPage = lazy(() => import('./pages/admin/integrations/company-registry/page'))
const AdminConsolidationPage = lazy(() => import('./pages/admin/integrations/consolidation/page'))
const AdminEtfHoldingsIngestionPage = lazy(() => import('./pages/admin/integrations/etf-holdings/page'))
const AdminEtfRegistryIngestionPage = lazy(() => import('./pages/admin/integrations/etf-registry/page'))
const AdminFundLinksPage = lazy(() => import('./pages/admin/integrations/fund-links/page'))
const AdminFundRegistryIngestionPage = lazy(() => import('./pages/admin/integrations/fund-registry/page'))
const AdminFundShareValueIngestionPage = lazy(() => import('./pages/admin/integrations/fund-share-values/page'))
const AdminMarketDataSeriesIngestionPage = lazy(() => import('./pages/admin/integrations/market-series/page'))
const AdminQuoteIngestionPage = lazy(() => import('./pages/admin/integrations/quotes/page'))
const AdminTaskRunsPage = lazy(() => import('./pages/admin/integrations/runs/page'))
const AdminUsdBrlIngestionPage = lazy(() => import('./pages/admin/integrations/usd-brl/page'))
const AdminUsersPage = lazy(() => import('./pages/admin/users/page'))
const LoginPage = lazy(() => import('./pages/login'))
const MarketAssetPage = lazy(() => import('./pages/market/asset/page'))
const MarketAtivosPage = lazy(() => import('./pages/market/ativos/page'))
const PensionPage = lazy(() => import('./pages/portfolio/pension/page'))
const MarketCataloguePage = lazy(() => import('./pages/market/catalogue/page'))
const MarketFIIPage = lazy(() => import('./pages/market/fii/page'))
const MarketInvestmentFundPage = lazy(() => import('./pages/market/investment-fund/page'))
const MarketLaboratoryPage = lazy(() => import('./pages/market/laboratory/page'))
const MarketLaboratoryComparePage = lazy(() => import('./pages/market/laboratory/compare/page'))
const MarketOverviewPage = lazy(() => import('./pages/market/overview/page'))
const MarketSeriesPage = lazy(() => import('./pages/market/series/page'))
const MarketUsdBrlPage = lazy(() => import('./pages/market/usd-brl/page'))
const PortfolioAssetsPage = lazy(() => import('./pages/portfolio/asset'))
const PortfolioAssetPage = lazy(() => import('./pages/portfolio/asset/[id]/page'))
const PortfolioCategoryPage = lazy(() => import('./pages/portfolio/category/page'))
const CityPage = lazy(() => import('./pages/portfolio/city/page'))
const DistributionPage = lazy(() => import('./pages/portfolio/distribution/page'))
const PortfolioDocumentsPage = lazy(() => import('./pages/portfolio/documents/page'))
const PortfolioDividendsPage = lazy(() => import('./pages/portfolio/dividends/page'))
const PortfolioSegmentPage = lazy(() => import('./pages/portfolio/segment/page'))
const PortfolioReturnsPage = lazy(() => import('./pages/portfolio/returns/page'))
const PortfolioRiskPage = lazy(() => import('./pages/portfolio/risk/page'))
const TaxIncomePage = lazy(() => import('./pages/portfolio/tax-income/page'))
const PortfolioTransactionsPage = lazy(() => import('./pages/portfolio/trades/page'))
const UserConfigurationPage = lazy(() => import('./pages/portfolio/user-configurations/page'))
const PortfolioPatrimonyEvolution = lazy(() => import('./pages/portfolio/wealth/page'))

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
      <Suspense fallback={<RouteSkeleton />}>
        <RouterProvider router={router} />
      </Suspense>
    </ThemeRegistry>
  )
}

export default App
