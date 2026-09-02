import { NavLink } from "react-router-dom";
import {
  Home,
  ListChecks,
  MessageCircle,
  Settings,
  Wallet,
} from "lucide-react";
import { useApp } from "../context/AppContext";

const BUYER_TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/orders", label: "Orders", icon: MessageCircle },
];

const OWNER_TABS = [
  { to: "/owner", label: "Dashboard", icon: Home, end: true },
  { to: "/owner/requests", label: "Requests", icon: ListChecks },
  { to: "/owner/earnings", label: "Earnings", icon: Wallet },
  { to: "/owner/settings", label: "Settings", icon: Settings },
];

export default function BottomNav() {
  const { role } = useApp();
  const tabs = role === "owner" ? OWNER_TABS : BUYER_TABS;

  return (
    <nav className="sticky bottom-0 z-20 flex items-stretch border-t border-black/5 bg-white/95 backdrop-blur">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              isActive ? "text-accent" : "text-navy/40"
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
