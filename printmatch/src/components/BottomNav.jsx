import { NavLink } from "react-router-dom";
import {
  Home,
  ListChecks,
  MessageCircle,
  Settings,
  Wallet,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { jobs } from "../data/mockData";

const PENDING_REQUESTS = jobs.filter((j) => j.status === "pending").length;

export default function BottomNav() {
  const { role, activeOrderCount } = useApp();

  const BUYER_TABS = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/orders", label: "Orders", icon: MessageCircle, badge: activeOrderCount },
  ];

  const OWNER_TABS = [
    { to: "/owner", label: "Dashboard", icon: Home, end: true },
    { to: "/owner/requests", label: "Requests", icon: ListChecks, badge: PENDING_REQUESTS },
    { to: "/owner/earnings", label: "Earnings", icon: Wallet },
    { to: "/owner/settings", label: "Settings", icon: Settings },
  ];

  const tabs = role === "owner" ? OWNER_TABS : BUYER_TABS;

  return (
    <nav className="sticky bottom-0 z-20 flex items-stretch border-t border-black/5 bg-white/95 backdrop-blur">
      {tabs.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              isActive ? "text-accent" : "text-navy/40"
            }`
          }
        >
          <span className="relative">
            <Icon size={20} />
            {!!badge && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                {badge}
              </span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
