import { Layers, Repeat2, TrendingUp } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import { earnings } from "../../data/mockData";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Earnings() {
  const max = Math.max(...earnings.weeklyTrend, 1);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Earnings" />

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-navy/50">This month</p>
            <p className="mt-1 text-2xl font-bold text-navy">
              ${earnings.monthTotal.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-navy/50">Jobs completed</p>
            <p className="mt-1 text-2xl font-bold text-navy">
              {earnings.jobsCompletedMonth}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-4 text-sm font-semibold text-navy">This week</h2>
          <div className="flex h-28 gap-2.5">
            {earnings.weeklyTrend.map((val, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
                <div
                  className="w-full rounded-t-md bg-accent/80"
                  style={{ height: `${Math.max((val / max) * 100, 3)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2.5">
            {DAY_LABELS.map((label, i) => (
              <span
                key={i}
                className="flex-1 text-center text-[10px] text-navy/40"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2.5 text-sm font-semibold text-navy">Insights</h2>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy/50">
                <Layers size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy">{earnings.topMaterial}</p>
                <p className="text-xs text-navy/50">Your most-requested material</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy/50">
                <TrendingUp size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy">{earnings.busiestDay}</p>
                <p className="text-xs text-navy/50">Your busiest day this month</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy/50">
                <Repeat2 size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy">{earnings.repeatCustomerPct}% repeat</p>
                <p className="text-xs text-navy/50">Customers who've ordered more than once</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
