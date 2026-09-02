import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CreditCard, LogOut, MapPin, Plus, Trash2 } from "lucide-react";
import RoleToggle from "../../components/RoleToggle";
import { useApp } from "../../context/AppContext";

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Account() {
  const navigate = useNavigate();
  const {
    currentUser,
    updateCurrentUser,
    logout,
    addresses,
    addAddress,
    removeAddress,
    paymentMethods,
    addPaymentMethod,
    removePaymentMethod,
  } = useApp();

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(currentUser?.phone ?? "");
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddressLine, setNewAddressLine] = useState("");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const savePhone = () => {
    updateCurrentUser({ phone: phoneDraft.trim() });
    setEditingPhone(false);
  };

  const submitAddress = (e) => {
    e.preventDefault();
    if (!newAddressLabel.trim() || !newAddressLine.trim()) return;
    addAddress(newAddressLabel.trim(), newAddressLine.trim());
    setNewAddressLabel("");
    setNewAddressLine("");
  };

  const addMockCard = () => {
    const last4 = Math.floor(1000 + Math.random() * 9000);
    addPaymentMethod(`Card •••• ${last4}`);
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-navy px-4 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Account</h1>
          <RoleToggle />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold">
            {initials(currentUser?.name ?? "?")}
          </div>
          <div>
            <p className="text-base font-semibold">{currentUser?.name}</p>
            <p className="text-xs text-white/60">{currentUser?.email}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Profile</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-navy/50">Phone</span>
            {editingPhone ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  onBlur={savePhone}
                  onKeyDown={(e) => e.key === "Enter" && savePhone()}
                  placeholder="(555) 000-0000"
                  className="w-36 rounded-lg bg-gray-50 px-2.5 py-1.5 text-right text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingPhone(true)}
                className="font-medium text-navy underline-offset-2 hover:underline"
              >
                {currentUser?.phone || "Add phone"}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Saved addresses</h2>
          <div className="space-y-2">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="flex items-start gap-2.5 rounded-xl bg-navy/5 px-3.5 py-2.5"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-navy/40" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-navy">{addr.label}</p>
                  <p className="text-xs text-navy/50">{addr.line}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAddress(addr.id)}
                  className="shrink-0 text-navy/30 hover:text-red-500"
                  aria-label={`Remove ${addr.label}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={submitAddress} className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={newAddressLabel}
                onChange={(e) => setNewAddressLabel(e.target.value)}
                placeholder="Label (e.g. Home)"
                className="w-28 rounded-lg bg-gray-50 px-2.5 py-2 text-xs text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
              />
              <input
                value={newAddressLine}
                onChange={(e) => setNewAddressLine(e.target.value)}
                placeholder="Street, city, state, ZIP"
                className="min-w-0 flex-1 rounded-lg bg-gray-50 px-2.5 py-2 text-xs text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
              />
            </div>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-navy/20 py-2 text-xs font-semibold text-navy/60 active:scale-[0.98]"
            >
              <Plus size={13} /> Add address
            </button>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Payment methods</h2>
          <div className="space-y-2">
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center gap-2.5 rounded-xl bg-navy/5 px-3.5 py-2.5"
              >
                <CreditCard size={15} className="shrink-0 text-navy/40" />
                <p className="flex-1 text-xs font-medium text-navy">{pm.label}</p>
                <button
                  type="button"
                  onClick={() => removePaymentMethod(pm.id)}
                  className="shrink-0 text-navy/30 hover:text-red-500"
                  aria-label={`Remove ${pm.label}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMockCard}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-navy/20 py-2 text-xs font-semibold text-navy/60 active:scale-[0.98]"
          >
            <Plus size={13} /> Add card
          </button>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 py-3 text-sm font-semibold text-red-500 active:scale-[0.98]"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </div>
  );
}
