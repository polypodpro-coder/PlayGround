import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  order as mockOrder,
  quotes as mockQuotes,
  printers as mockPrinters,
  MY_PRINTER_ID,
} from "../data/mockData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [role, setRole] = useState("buyer"); // 'buyer' | 'owner'
  const [request, setRequest] = useState(null); // in-progress buyer request
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [order, setOrder] = useState(mockOrder);
  const [printers, setPrinters] = useState(mockPrinters);

  const toggleRole = () =>
    setRole((r) => (r === "buyer" ? "owner" : "buyer"));

  const acceptQuote = (quote) => {
    setSelectedQuote(quote);
  };

  const placeOrder = () => {
    setOrder({ ...mockOrder, status: "queued", progressPct: 4 });
  };

  const updatePrinter = useCallback((id, patch) => {
    setPrinters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }, []);

  // "My shop" = the signed-in printer owner's own listing (Dana's Print
  // Shop / Riverside Rapid Prints). Editing it in Settings updates the
  // same record buyers see on the home feed and map.
  const myShop = useMemo(
    () => printers.find((p) => p.id === MY_PRINTER_ID) ?? printers[0],
    [printers]
  );
  const updateMyShop = useCallback(
    (patch) => updatePrinter(MY_PRINTER_ID, patch),
    [updatePrinter]
  );

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
      printers,
      updatePrinter,
      myShop,
      updateMyShop,
    }),
    [role, request, selectedQuote, order, printers, updatePrinter, myShop, updateMyShop]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
