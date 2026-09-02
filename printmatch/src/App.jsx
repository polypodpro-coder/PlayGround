import { Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";

import HomeFeed from "./pages/buyer/HomeFeed";
import ShopProfile from "./pages/buyer/ShopProfile";
import RequestUpload from "./pages/buyer/RequestUpload";
import Quotes from "./pages/buyer/Quotes";
import Checkout from "./pages/buyer/Checkout";
import OrderHistory from "./pages/buyer/OrderHistory";
import OrderTracking from "./pages/buyer/OrderTracking";

import Dashboard from "./pages/owner/Dashboard";
import Requests from "./pages/owner/Requests";
import JobDetail from "./pages/owner/JobDetail";
import Earnings from "./pages/owner/Earnings";
import PrinterSettings from "./pages/owner/PrinterSettings";

// Screens with their own sub-flow (upload, checkout, an individual order's
// chat) hide the bottom nav so the primary CTA / back button stays in
// focus. Bottom-nav destinations themselves (/orders list, /shop profile)
// keep the nav visible since they're browse screens, not task flows.
const HIDE_NAV_PREFIXES = ["/request", "/quotes", "/checkout", "/owner/requests/"];

export default function App() {
  const { pathname } = useLocation();
  const hideNav =
    HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p)) ||
    /^\/orders\/.+/.test(pathname);

  return (
    <div className="app-shell">
      <div className="flex min-h-0 flex-1 flex-col">
        <Routes>
          {/* Buyer flow */}
          <Route path="/" element={<HomeFeed />} />
          <Route path="/shop/:printerId" element={<ShopProfile />} />
          <Route path="/request" element={<RequestUpload />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/orders/:orderId" element={<OrderTracking />} />

          {/* Printer owner flow */}
          <Route path="/owner" element={<Dashboard />} />
          <Route path="/owner/requests" element={<Requests />} />
          <Route path="/owner/requests/:jobId" element={<JobDetail />} />
          <Route path="/owner/earnings" element={<Earnings />} />
          <Route path="/owner/settings" element={<PrinterSettings />} />
        </Routes>
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
