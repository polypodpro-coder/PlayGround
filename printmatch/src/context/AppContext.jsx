import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  orders as mockOrders,
  quotes as mockQuotes,
  printers as mockPrinters,
  users as mockUsers,
  savedAddresses as mockAddresses,
  savedPaymentMethods as mockPaymentMethods,
  MATERIAL_MULTIPLIERS,
  FLEET_MACHINES,
  POST_PROCESSING_ADDONS,
  MY_PRINTER_ID,
  REFERRAL_BONUS,
} from "../data/mockData";

const AppContext = createContext(null);
const SESSION_KEY = "polypod.session";

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
    // Storage unavailable
  }
}

export function AppProvider({ children }) {
  const [session] = useState(loadSession); // read once, at mount
  const [role, setRole] = useState(session?.role ?? "buyer"); // 'buyer' | 'owner'
  const [currentUser, setCurrentUser] = useState(session?.currentUser ?? null);
  const [request, setRequest] = useState(null); // in-progress buyer request
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [directRequestPrinterId, setDirectRequestPrinterId] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState(null); // catalog design attached to the current request
  const [orders, setOrders] = useState(mockOrders);
  const [printers, setPrinters] = useState(mockPrinters);
  const [favorites, setFavorites] = useState(() => new Set());
  const [addresses, setAddresses] = useState(mockAddresses);
  const [paymentMethods, setPaymentMethods] = useState(mockPaymentMethods);
  const [toast, setToast] = useState(null);

  // Track 2: Quoting Engine State
  const [selectedMaterial, setSelectedMaterial] = useState("PETG");
  const [selectedMachineId, setSelectedMachineId] = useState("bambu-x1c");
  const [selectedAddons, setSelectedAddons] = useState([]); // array of addon IDs (e.g. ['splitAndBond', 'hardwareInstall'])

  const showToast = useCallback((message, type = "info", duration = 3500) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr && curr.message === message ? null : curr));
    }, duration);
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    saveSession({ currentUser, role });
  }, [currentUser, role]);

  const toggleRole = useCallback(() => {
    setRole((r) => (r === "buyer" ? "owner" : "buyer"));
  }, []);

  const toggleAddon = useCallback((addonId) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  }, []);

  // Dynamic Quote Calculation Breakdown
  const quoteBreakdown = useMemo(() => {
    const grams = request?.estimatedGrams || 40;
    const mat = selectedMaterial || request?.material || "PETG";
    const matInfo = MATERIAL_MULTIPLIERS[mat] || { multiplier: 1.0, rate: 0.08, category: "Standard" };
    const baseCost = grams * matInfo.rate;
    let addonCost = 0;
    const activeAddonsList = [];
    selectedAddons.forEach((id) => {
      const found = POST_PROCESSING_ADDONS.find((addon) => addon.id === id);
      if (found) {
        addonCost += found.cost;
        activeAddonsList.push(found);
      }
    });
    const subtotal = baseCost + addonCost;
    const low = Math.max(7, Math.round(subtotal * 0.9));
    const high = Math.max(10, Math.round(subtotal * 1.25));

    return {
      grams,
      material: mat,
      materialMultiplier: matInfo.multiplier,
      materialRate: matInfo.rate,
      materialCategory: matInfo.category,
      baseCost,
      addonCost,
      activeAddons: activeAddonsList,
      subtotal,
      low,
      high,
      machineId: selectedMachineId,
    };
  }, [request, selectedMaterial, selectedAddons, selectedMachineId]);

  const login = useCallback((email) => {
    const existing = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const name = titleCaseFromEmail(email);
    const user =
      existing ?? {
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

  const placeOrder = useCallback(
    (extra = {}) => {
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
        material: selectedQuote?.material ?? selectedMaterial,
        color: selectedQuote?.color ?? "Black",
        machineId: selectedQuote?.machineId ?? selectedMachineId,
        addons: selectedQuote?.addons ?? selectedAddons,
        createdAt: new Date().toISOString(),
        messages: [],
        viewed: false,
        rated: false,
        ...orderFields,
      };
      setOrders((prev) => [newOrder, ...prev]);
      if (creditsUsed > 0) {
        setCurrentUser((prev) =>
          prev ? { ...prev, credits: Math.max(0, (prev.credits ?? 0) - creditsUsed) } : prev
        );
      }
      setDirectRequestPrinterId(null);
      setSelectedDesign(null);
      return id;
    },
    [selectedQuote, selectedMaterial, selectedMachineId, selectedAddons]
  );

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

  // Stateful Quoting Engine: calculates dynamic quotes for nearby shops based on material multiplier and add-ons
  const quotes = useMemo(() => {
    const grams = request?.estimatedGrams ?? 55;
    const mat = selectedMaterial || request?.material || "PETG";
    const matInfo = MATERIAL_MULTIPLIERS[mat] || { multiplier: 1.0, rate: 0.08 };
    let addonCost = 0;
    selectedAddons.forEach((id) => {
      const a = POST_PROCESSING_ADDONS.find((item) => item.id === id);
      if (a) addonCost += a.cost;
    });

    if (!directRequestPrinterId) {
      return mockQuotes.map((q) => {
        const base = q.price * (matInfo.multiplier / 1.0) * (grams / 55);
        const finalPrice = Math.round((base + addonCost) * 10) / 10;
        return {
          ...q,
          price: Math.max(8, finalPrice),
          material: mat,
          machineId: selectedMachineId,
          addons: [...selectedAddons],
        };
      });
    }

    const shop = printers.find((p) => p.id === directRequestPrinterId);
    if (!shop) return mockQuotes;
    const rate = (shop.pricingRates?.[mat] ?? shop.pricingRates?.PLA ?? 0.08) * matInfo.multiplier;
    const base = rate * grams;
    const price = Math.max(8, Math.round((base + addonCost) * 10) / 10);
    return [
      {
        id: `direct-${shop.id}`,
        jobId: "direct",
        printerId: shop.id,
        price,
        etaHours: shop.turnaroundLabel === "Same day" ? 8 : shop.turnaroundLabel === "24hr" ? 24 : 48,
        material: mat,
        color: "As specified",
        machineId: selectedMachineId,
        addons: [...selectedAddons],
      },
    ];
  }, [directRequestPrinterId, printers, request, selectedMaterial, selectedAddons, selectedMachineId]);

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
    setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

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
      selectedDesign,
      setSelectedDesign,
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
      toast,
      showToast,
      hideToast,
      // Track 2 Exports
      selectedMaterial,
      setSelectedMaterial,
      selectedMachineId,
      setSelectedMachineId,
      selectedAddons,
      toggleAddon,
      quoteBreakdown,
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
      selectedDesign,
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
      toast,
      showToast,
      hideToast,
      selectedMaterial,
      selectedMachineId,
      selectedAddons,
      toggleAddon,
      quoteBreakdown,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
