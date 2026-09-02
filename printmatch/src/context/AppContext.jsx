import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  orders as mockOrders,
  quotes as mockQuotes,
  printers as mockPrinters,
  users as mockUsers,
  savedAddresses as mockAddresses,
  savedPaymentMethods as mockPaymentMethods,
  MY_PRINTER_ID,
  REFERRAL_BONUS,
} from "../data/mockData";

const AppContext = createContext(null);
const SESSION_KEY = "printmatch.session";

function titleCaseFromEmail(email) {
  const local = email.split("@")[0] ?? "there";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function generateReferralCode(name) {
  const base = (name.split(" ")[0] || "FRIEND").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "FRIEND";
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

// A refresh shouldn't sign the user out — persist just enough of the
// session (who's logged in, which role they were viewing) to a local
// browser-only session, separate from the rest of the mock data.
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable (private browsing, disabled) — session just
    // won't survive a refresh this time, which is fine.
  }
}

export function AppProvider({ children }) {
  const [session] = useState(loadSession); // read once, at mount
  const [role, setRole] = useState(session?.role ?? "buyer"); // 'buyer' | 'owner'
  const [currentUser, setCurrentUser] = useState(session?.currentUser ?? null);
  const [request, setRequest] = useState(null); // in-progress buyer request
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [directRequestPrinterId, setDirectRequestPrinterId] = useState(null);
  const [orders, setOrders] = useState(mockOrders);
  const [printers, setPrinters] = useState(mockPrinters);
  const [favorites, setFavorites] = useState(() => new Set());
  const [addresses, setAddresses] = useState(mockAddresses);
  const [paymentMethods, setPaymentMethods] = useState(mockPaymentMethods);

  const toggleRole = () =>
    setRole((r) => (r === "buyer" ? "owner" : "buyer"));

  // Keep the persisted session in sync so a page refresh doesn't sign
  // the user back out.
  useEffect(() => {
    saveSession(currentUser ? { currentUser, role } : null);
  }, [currentUser, role]);

  // Mock auth: no real backend, so this just matches (or creates) a local
  // user record — any password "works." Matching a known mock account
  // also switches into that account's role so login lands on the right
  // experience.
  const login = useCallback((email) => {
    const match = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const name = match?.name ?? titleCaseFromEmail(email);
    const user =
      match ?? {
        id: `u${Date.now()}`,
        name,
        email,
        role: "buyer",
        referralCode: generateReferralCode(name),
        credits: 0,
      };
    setCurrentUser(user);
    setRole(user.role);
  }, []);

  // A referral code entered at signup grants the new signee a one-time
  // credit — mirrors the "give $10, get $10" copy real referral programs
  // show the invitee, even though (same as those apps) crediting the
  // referrer back happens on a side this single-session demo can't reach.
  const signup = useCallback(({ name, email, role: signupRole, referralCode }) => {
    const user = {
      id: `u${Date.now()}`,
      name,
      email,
      role: signupRole,
      referralCode: generateReferralCode(name),
      credits: referralCode?.trim() ? REFERRAL_BONUS : 0,
    };
    setCurrentUser(user);
    setRole(signupRole);
  }, []);

  const quickLogin = useCallback((asRole) => {
    const user = mockUsers.find((u) => u.role === asRole) ?? mockUsers[0];
    setCurrentUser(user);
    setRole(user.role);
  }, []);

  const logout = useCallback(() => setCurrentUser(null), []);

  const updateCurrentUser = useCallback((patch) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const acceptQuote = (quote) => {
    setSelectedQuote(quote);
  };

  const updateOrder = useCallback((id, patch) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  // Builds a fresh order from the accepted quote (plus whatever checkout
  // options are passed in, e.g. delivery method, tip, credit applied) and
  // returns its id, so Checkout can route straight to that order's
  // tracking screen.
  const placeOrder = useCallback((extra = {}) => {
    const { creditsUsed = 0, ...orderFields } = extra;
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
      rated: false,
      ...orderFields,
    };
    setOrders((prev) => [newOrder, ...prev]);
    if (creditsUsed > 0) {
      setCurrentUser((prev) => (prev ? { ...prev, credits: Math.max(0, (prev.credits ?? 0) - creditsUsed) } : prev));
    }
    setDirectRequestPrinterId(null);
    return id;
  }, [selectedQuote]);

  // Post-order rating: appends a review to the printer and marks the
  // order as rated so the prompt doesn't show again.
  const rateOrder = useCallback(
    (orderId, printerId, { rating, text }) => {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, rated: true } : o)));
      setPrinters((prev) =>
        prev.map((p) =>
          p.id === printerId
            ? {
                ...p,
                reviews: [
                  {
                    id: `rev${Date.now()}`,
                    buyerName: currentUser?.name ?? "A buyer",
                    rating,
                    text,
                    date: new Date().toISOString().slice(0, 10),
                  },
                  ...(p.reviews ?? []),
                ],
              }
            : p
        )
      );
    },
    [currentUser]
  );

  // A single synthesized quote when the buyer requested one specific shop
  // directly from its profile, instead of broadcasting to every nearby
  // shop. Falls back to the mock multi-shop quote list otherwise.
  const quotes = useMemo(() => {
    if (!directRequestPrinterId) return mockQuotes;
    const shop = printers.find((p) => p.id === directRequestPrinterId);
    if (!shop) return mockQuotes;
    const material = request?.material ?? shop.materials[0];
    const rate = shop.pricingRates?.[material] ?? 0.08;
    const price = Math.max(6, Math.round(rate * 70 * 100) / 100);
    return [
      {
        id: `direct-${shop.id}`,
        jobId: "direct",
        printerId: shop.id,
        price,
        etaHours: shop.turnaroundLabel === "Same day" ? 8 : shop.turnaroundLabel === "24hr" ? 24 : 48,
        material,
        color: "As specified",
      },
    ];
  }, [directRequestPrinterId, printers, request]);

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

  const addAddress = useCallback((label, line) => {
    setAddresses((prev) => [...prev, { id: `addr${Date.now()}`, label, line }]);
  }, []);
  const removeAddress = useCallback((id) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addPaymentMethod = useCallback((label) => {
    setPaymentMethods((prev) => [...prev, { id: `pm${Date.now()}`, label }]);
  }, []);
  const removePaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      role,
      setRole,
      toggleRole,
      currentUser,
      isAuthenticated: !!currentUser,
      login,
      signup,
      quickLogin,
      logout,
      updateCurrentUser,
      request,
      setRequest,
      directRequestPrinterId,
      setDirectRequestPrinterId,
      quotes,
      selectedQuote,
      acceptQuote,
      orders,
      updateOrder,
      placeOrder,
      rateOrder,
      activeOrderCount,
      printers,
      updatePrinter,
      myShop,
      updateMyShop,
      favorites,
      toggleFavorite,
      addresses,
      addAddress,
      removeAddress,
      paymentMethods,
      addPaymentMethod,
      removePaymentMethod,
    }),
    [
      role,
      currentUser,
      login,
      signup,
      quickLogin,
      logout,
      updateCurrentUser,
      request,
      directRequestPrinterId,
      quotes,
      selectedQuote,
      orders,
      updateOrder,
      placeOrder,
      rateOrder,
      activeOrderCount,
      printers,
      updatePrinter,
      myShop,
      updateMyShop,
      favorites,
      toggleFavorite,
      addresses,
      addAddress,
      removeAddress,
      paymentMethods,
      addPaymentMethod,
      removePaymentMethod,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
