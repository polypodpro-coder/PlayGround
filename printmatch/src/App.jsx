import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import Toast from "./components/Toast";
import { useApp } from "./context/AppContext";

import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";

import HomeFeed from "./pages/buyer/HomeFeed";
import ShopProfile from "./pages/buyer/ShopProfile";
import DesignDetail from "./pages/buyer/DesignDetail";
import RequestUpload from "./pages/buyer/RequestUpload";
import Quotes from "./pages/buyer/Quotes";
import Checkout from "./pages/buyer/Checkout";
import OrderHistory from "./pages/buyer/OrderHistory";
import OrderTracking from "./pages/buyer/OrderTracking";
import Account from "./pages/buyer/Account";

import Dashboard from "./pages/owner/Dashboard";
import Requests from "./pages/owner/Requests";
import JobDetail from "./pages/owner/JobDetail";
import Earnings from "./pages/owner/Earnings";
import PrinterSettings from "./pages/owner/PrinterSettings";

const HIDE_NAV_PREFIXES = ["/request", "/quotes", "/checkout", "/owner/requests/"];
const AUTH_PATHS = ["/login", "/signup"];

export default function App() {
  const { pathname } = useLocation();
  const { isAuthenticated, role, toast, hideToast } = useApp();

  const isAuthPath = AUTH_PATHS.includes(pathname);
  if (!isAuthenticated && !isAuthPath) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthenticated && isAuthPath) {
    return <Navigate to={role === "owner" ? "/owner" : "/"} replace />;
  }

  const hideNav =
    isAuthPath ||
    HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p)) ||
    /^\/orders\/.+/.test(pathname);

  return (
    <div className="app-shell">
      <div className="flex min-h-0 flex-1 flex-col">
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Buyer flow */}
          <Route path="/" element={<HomeFeed />} />
          <Route path="/shop/:printerId" element={<ShopProfile />} />
          <Route path="/design/:designId" element={<DesignDetail />} />
          <Route path="/request" element={<RequestUpload />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/orders/:orderId" element={<OrderTracking />} />
          <Route path="/account" element={<Account />} />

          {/* Printer owner flow */}
          <Route path="/owner" element={<Dashboard />} />
          <Route path="/owner/requests" element={<Requests />} />
          <Route path="/owner/requests/:jobId" element={<JobDetail />} />
          <Route path="/owner/earnings" element={<Earnings />} />
          <Route path="/owner/settings" element={<PrinterSettings />} />

          {/* Track 3: Graceful fallback route to prevent 404 blank screens */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!hideNav && <BottomNav />}
      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}
