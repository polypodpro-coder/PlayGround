import { Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";

import HomeFeed from "./pages/buyer/HomeFeed";
import RequestUpload from "./pages/buyer/RequestUpload";
import Quotes from "./pages/buyer/Quotes";
import Checkout from "./pages/buyer/Checkout";
import OrderTracking from "./pages/buyer/OrderTracking";

import Dashboard from "./pages/owner/Dashboard";
import Requests from "./pages/owner/Requests";
import JobDetail from "./pages/owner/JobDetail";
import Earnings from "./pages/owner/Earnings";
import PrinterSettings from "./pages/owner/PrinterSettings";

// Screens with their own sub-flow (upload, checkout, chat) hide the bottom
// nav so the primary CTA / back button stays in focus.
const HIDE_NAV_PREFIXES = [
  "/request",
  "/quotes",
  "/checkout",
  "/orders",
  "/owner/requests/",
];

export default function App() {
  const { pathname } = useLocation();
  const hideNav = HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <div className="app-shell">
      <div className="flex min-h-0 flex-1 flex-col">
        <Routes>
          {/* Buyer flow */}
          <Route path="/" element={<HomeFeed />} />
          <Route path="/request" element={<RequestUpload />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<OrderTracking />} />

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
