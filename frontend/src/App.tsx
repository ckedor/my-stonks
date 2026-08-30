import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "./App.css";
import { initAuth } from "./actions/auth";
import MainLayout from "./layouts/MainLayout";
import AdminAIFeaturesPage from "./pages/admin/ai-features/page";
import AdminAssetsPage from "./pages/admin/assets/page";
import AdminBrokersPage from "./pages/admin/brokers/page";
import AdminWealthTiersPage from "./pages/admin/wealth-tiers/page";
import AdminConsolidationPage from "./pages/admin/consolidation/page";
import ArchitecturePage from "./pages/admin/architecture/ArchitecturePage";
import DesignSystemPage from "./pages/admin/design-system/page";
import AdminEventsPage from "./pages/admin/events/page";
import AdminQuoteIngestionPage from "./pages/admin/quote-ingestion/page";
import AdminMarketDataQuotesPage from "./pages/admin/market-data/quotes/page";
import AdminMarketDataSeriesPage from "./pages/admin/market-data/series/page";
import AdminMarketDataUsdBrlPage from "./pages/admin/market-data/usd-brl/page";
import AdminMarketDataSeriesIngestionPage from "./pages/admin/market-data-series-ingestion/page";
import AdminUsdBrlIngestionPage from "./pages/admin/usd-brl-ingestion/page";
import AdminLayout from "./pages/admin/layout";
import AdminUsersPage from "./pages/admin/users/page";
import LoginPage from "./pages/login";
import MarketAssetPage from "./pages/market/asset/page";
import MarketAtivosPage from "./pages/market/ativos/page";
import MarketCataloguePage from "./pages/market/catalogue/page";
import MarketFIIPage from "./pages/market/fii/page";
import MarketInvestmentFundPage from "./pages/market/investment-fund/page";
import MarketOverviewPage from "./pages/market/overview/page";
import PortfolioAssetsPage from "./pages/portfolio/asset";
import PortfolioAssetPage from "./pages/portfolio/asset/[id]/page";
import PortfolioCategoryPage from "./pages/portfolio/category/page";
import DistributionPage from "./pages/portfolio/distribution/page";
import PortfolioDividendsPage from "./pages/portfolio/dividends/page";
import PortfolioSegmentPage from "./pages/portfolio/segment/page";
import PortfolioOverviewPage from "./pages/portfolio/overview";
import PortfolioReturnsPage from "./pages/portfolio/returns/page";
import PortfolioRiskPage from "./pages/portfolio/risk/page";
import TaxIncomePage from "./pages/portfolio/tax-income/page";
import PortfolioTransactionsPage from "./pages/portfolio/trades/page";
import UserConfigurationPage from "./pages/portfolio/user-configurations/page";
import ThemeEditorPage from "./pages/portfolio/user-configurations/theme-editor/page";
import PortfolioPatrimonyEvolution from "./pages/portfolio/wealth/page";
import { ThemeRegistry } from "./theme";

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/portfolio/overview" replace /> },
      { path: "portfolio/overview", element: <PortfolioOverviewPage /> },
      { path: "portfolio/asset", element: <PortfolioAssetsPage /> },
      { path: "portfolio/asset/:id", element: <PortfolioAssetPage /> },
      { path: "portfolio/category", element: <PortfolioCategoryPage /> },
      { path: "portfolio/category/:id", element: <PortfolioCategoryPage /> },
      { path: "portfolio/distribution", element: <DistributionPage /> },
      { path: "portfolio/dividends", element: <PortfolioDividendsPage /> },
      { path: "portfolio/fii", element: <PortfolioSegmentPage segment="fii" /> },
      { path: "portfolio/equity-br", element: <PortfolioSegmentPage segment="equity-br" /> },
      { path: "portfolio/equity-world", element: <PortfolioSegmentPage segment="equity-world" /> },
      { path: "portfolio/fixed-income", element: <PortfolioSegmentPage segment="fixed-income" /> },
      { path: "portfolio/crypto", element: <PortfolioSegmentPage segment="crypto" /> },
      { path: "portfolio/returns", element: <PortfolioReturnsPage /> },
      { path: "portfolio/analysis", element: <PortfolioRiskPage /> },
      { path: "portfolio/tax-income", element: <TaxIncomePage /> },
      { path: "portfolio/trades", element: <PortfolioTransactionsPage /> },
      { path: "portfolio/wealth", element: <PortfolioPatrimonyEvolution /> },
      // Distribuição e rebalanceamento viraram uma tela só; o link antigo
      // continua chegando nela.
      { path: "portfolio/rebalancing", element: <Navigate to="/portfolio/distribution" replace /> },
      { path: "portfolio/user-configurations", element: <UserConfigurationPage /> },
      { path: "portfolio/user-configurations/theme-editor", element: <ThemeEditorPage /> },
      { path: "portfolio/user-configurations/theme-editor/:id", element: <ThemeEditorPage /> },
      { path: "market/assets", element: <MarketAtivosPage /> },
      { path: "market/overview", element: <MarketOverviewPage /> },
      { path: "market/fii", element: <MarketFIIPage /> },
      { path: "market/investment-fund", element: <MarketInvestmentFundPage /> },
      { path: "market/stock", element: <MarketCataloguePage kind="stock" /> },
      { path: "market/etf", element: <MarketCataloguePage kind="etf" /> },
      { path: "market/crypto", element: <MarketCataloguePage kind="crypto" /> },
      { path: "market/asset/:id", element: <MarketAssetPage /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { path: "assets", element: <AdminAssetsPage /> },
      { path: "brokers", element: <AdminBrokersPage /> },
      { path: "wealth-tiers", element: <AdminWealthTiersPage /> },
      { path: "events", element: <AdminEventsPage /> },
      { path: "users", element: <AdminUsersPage /> },
      { path: "design-system", element: <DesignSystemPage /> },
      { path: "ai-features", element: <AdminAIFeaturesPage /> },
      { path: "quote-ingestion", element: <AdminQuoteIngestionPage /> },
      { path: "market-data/usd-brl", element: <AdminMarketDataUsdBrlPage /> },
      { path: "market-data/series", element: <AdminMarketDataSeriesPage /> },
      { path: "market-data/quotes", element: <AdminMarketDataQuotesPage /> },
      { path: "market-data-series-ingestion", element: <AdminMarketDataSeriesIngestionPage /> },
      { path: "usd-brl-ingestion", element: <AdminUsdBrlIngestionPage /> },
      { path: "consolidation", element: <AdminConsolidationPage /> },
      { path: "architecture", element: <ArchitecturePage /> },
      { index: true, element: <Navigate to="/admin/assets" replace /> },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/*",
    element: <div>404 Not Found</div>,
  },
]);

// Initialize auth from cookie on app startup
initAuth()

function App() {
  return (
    <ThemeRegistry>
      <RouterProvider router={router} />
    </ThemeRegistry>
  );
}

export default App;
