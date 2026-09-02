import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronRight, TrendingUp } from "lucide-react";
import RoleToggle from "../../components/RoleToggle";
import StatusBadge from "../../components/StatusBadge";
import ShopLogo from "../../components/ShopLogo";
import { earnings, jobs, ownerPrinters } from "../../data/mockData";
import { useApp } from "../../context/AppContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { myShop } = useApp();
  const primaryPrinter = ownerPrinters[0];
  const pendingJobs = jobs.filter((j) => j.status === "pending");

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-navy px-4 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShopLogo src={myShop.logoUrl} alt={`${myShop.name} logo`} />
            <div>
              <p className="text-xs text-white/60">Welcome back</p>
              <h1 className="text-lg font-semibold">Dana's Print Shop</h1>
            </div>
          </div>
          <RoleToggle />
        </div>

        <div className="mt-5 rounded-2xl bg-white/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/70">Earnings this week</p>
            <span className="flex items-center gap-1 text-xs font-semibold text-accent">
              <TrendingUp size={13} />
              +18%
            </span>
          </div>
          <p className="mt-1 text-3xl font-bold">${earnings.weekTotal.toFixed(2)}</p>
        </div>
      </header>

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div>
            <p className="text-sm font-semibold text-navy">{primaryPrinter.name}</p>
            <p className="text-xs text-navy/50">Primary printer</p>
          </div>
          <StatusBadge status={primaryPrinter.status} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Incoming requests</h2>
            <button
              onClick={() => navigate("/owner/requests")}
              className="flex items-center text-xs font-semibold text-accent"
            >
              View all <ChevronRight size={14} />
            </button>
          </div>

          <div className="space-y-2.5">
            {pendingJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => navigate(`/owner/requests/${job.id}`)}
                className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 active:scale-[0.98]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">
                    {job.buyerName}
                  </p>
                  <p className="truncate text-xs text-navy/50">
                    {job.material} · Qty {job.quantity} · {job.fileName}
                  </p>
                </div>
                <span className="ml-3 flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                  Quote <ArrowUpRight size={13} />
                </span>
              </button>
            ))}
            {pendingJobs.length === 0 && (
              <p className="py-6 text-center text-sm text-navy/40">
                No new requests right now.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
