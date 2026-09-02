import { createContext, useContext, useMemo, useState } from "react";
import {
  order as mockOrder,
  quotes as mockQuotes,
} from "../data/mockData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [role, setRole] = useState("buyer"); // 'buyer' | 'owner'
  const [request, setRequest] = useState(null); // in-progress buyer request
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [order, setOrder] = useState(mockOrder);

  const toggleRole = () =>
    setRole((r) => (r === "buyer" ? "owner" : "buyer"));

  const acceptQuote = (quote) => {
    setSelectedQuote(quote);
  };

  const placeOrder = () => {
    setOrder({ ...mockOrder, status: "queued", progressPct: 4 });
  };

  const value = useMemo(
    () => ({
      role,
      setRole,
      toggleRole,
      request,
      setRequest,
      quotes: mockQuotes,
      selectedQuote,
      acceptQuote,
      order,
      placeOrder,
    }),
    [role, request, selectedQuote, order]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
