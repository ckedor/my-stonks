import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "./App.css";
import { initAuth } from "./actions/auth";
import MainLayout from "./layouts/MainLayout";
import AdminAIFeaturesPage from "./pages/admin/ai-features/page";
import AdminAssetsPage from "./pages/admin/assets/page";
import AdminBrokersPage from "./pages/admin/brokers/page";
import DesignSystemPage from "./pages/admin/design-system/page";
import AdminEventsPage from "./pages/admin/events/page";
import AdminLayout from "./pages/admin/layout";
import AdminUsersPage from "./pages/admin/users/page";
import LoginPage from "./pages/login";
import MarketAssetPage from "./pages/market/asset/page";
import MarketAtivosPage from "./pages/market/ativos/page";
import PortfolioAssetsPage from "./pages/portfolio/asset";
import DistributionPage from "./pages/portfolio/distribution/page";
import PortfolioDividendsPage from "./pages/portfolio/dividends/page";
import PortfolioOverviewPage from "./pages/portfolio/overview";
import RebalancingPage from "./pages/portfolio/rebalancing/page";
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
      { path: "portfolio/distribution", element: <DistributionPage /> },
      { path: "portfolio/dividends", element: <PortfolioDividendsPage /> },
      { path: "portfolio/returns", element: <PortfolioReturnsPage /> },
      { path: "portfolio/analysis", element: <PortfolioRiskPage /> },
      { path: "portfolio/tax-income", element: <TaxIncomePage /> },
      { path: "portfolio/trades", element: <PortfolioTransactionsPage /> },
      { path: "portfolio/wealth", element: <PortfolioPatrimonyEvolution /> },
      { path: "portfolio/rebalancing", element: <RebalancingPage /> },
      { path: "portfolio/user-configurations", element: <UserConfigurationPage /> },
      { path: "portfolio/user-configurations/theme-editor", element: <ThemeEditorPage /> },
      { path: "portfolio/user-configurations/theme-editor/:id", element: <ThemeEditorPage /> },
      { path: "market/assets", element: <MarketAtivosPage /> },
      { path: "market/asset/:id", element: <MarketAssetPage /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { path: "assets", element: <AdminAssetsPage /> },
      { path: "brokers", element: <AdminBrokersPage /> },
      { path: "events", element: <AdminEventsPage /> },
      { path: "users", element: <AdminUsersPage /> },
      { path: "design-system", element: <DesignSystemPage /> },
      { path: "ai-features", element: <AdminAIFeaturesPage /> },
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
