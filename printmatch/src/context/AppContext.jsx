import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  orders as mockOrders,
  quotes as mockQuotes,
  printers as mockPrinters,
  MY_PRINTER_ID,
} from "../data/mockData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [role, setRole] = useState("buyer"); // 'buyer' | 'owner'
  const [request, setRequest] = useState(null); // in-progress buyer request
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [orders, setOrders] = useState(mockOrders);
  const [printers, setPrinters] = useState(mockPrinters);
  const [favorites, setFavorites] = useState(() => new Set());

  const toggleRole = () =>
    setRole((r) => (r === "buyer" ? "owner" : "buyer"));

  const acceptQuote = (quote) => {
    setSelectedQuote(quote);
  };

  const updateOrder = useCallback((id, patch) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  // Builds a fresh order from the accepted quote (plus whatever checkout
  // options are passed in, e.g. delivery method) and returns its id, so
  // Checkout can route straight to that order's tracking screen.
  const placeOrder = useCallback((extra = {}) => {
    const id = `o${Date.now()}`;
    const newOrder = {
      id,
      printerId: selectedQuote?.printerId ?? MY_PRINTER_ID,
      status: "queued",
      progressPct: 4,
      etaLabel: "Just placed",
      printCost: selectedQuote?.price ?? 18.5,
      serviceFee: 2.5,
      material: selectedQuote?.material ?? "PLA",
      color: selectedQuote?.color ?? "Black",
      createdAt: new Date().toISOString(),
      messages: [],
      viewed: false,
      ...extra,
    };
    setOrders((prev) => [newOrder, ...prev]);
    return id;
  }, [selectedQuote]);

  const activeOrderCount = useMemo(
    () => orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length,
    [orders]
  );

  const toggleFavorite = useCallback((printerId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(printerId)) next.delete(printerId);
      else next.add(printerId);
      return next;
    });
  }, []);

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
      orders,
      updateOrder,
      placeOrder,
      activeOrderCount,
      printers,
      updatePrinter,
      myShop,
      updateMyShop,
      favorites,
      toggleFavorite,
    }),
    [
      role,
      request,
      selectedQuote,
      orders,
      updateOrder,
      placeOrder,
      activeOrderCount,
      printers,
      updatePrinter,
      myShop,
      updateMyShop,
      favorites,
      toggleFavorite,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
