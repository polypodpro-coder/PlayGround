import { Link } from "react-router-dom";
import { ArrowRight, CircleDollarSign, Layers, Repeat2 } from "lucide-react";
import { earnings } from "../../data/mockData";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const money = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

export default function Earnings() {
  const maximum = Math.max(...earnings.weeklyTrend, 1);
  return (
    <div className="app-page stack">
      <header><p className="eyebrow">PRINT FARM / EARNINGS</p><h1 className="page-heading">A clearer view of your business.</h1><p>Explore sales activity and the costs that sit between revenue and take-home earnings.</p></header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4"><p className="text-sm leading-6 text-navy/75"><strong>Sample financial data.</strong> These figures are illustrative gross sales. There is no live balance or payout account.</p><span className="badge">USD · Example month</span></div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Sample monthly sales", money(earnings.monthTotal), "Before costs, tax, and fees"], ["Sample weekly sales", money(earnings.weekTotal), "Illustrative sales activity"], ["Sample completed jobs", earnings.jobsCompletedMonth, "Example monthly volume"]].map(([label, value, detail]) => <section className="panel" key={label}><p className="text-sm text-navy/65">{label}</p><p className="my-3 text-3xl font-semibold tracking-tight text-navy">{value}</p><p className="text-sm text-navy/60">{detail}</p></section>)}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel">
          <div className="section-heading"><p className="eyebrow">SALES ACTIVITY</p><h2>One sample week</h2></div>
          <div className="mt-8 grid h-60 grid-cols-7 items-end gap-2 sm:gap-4" role="img" aria-label={`Sample daily gross sales: ${earnings.weeklyTrend.map((value, index) => `${DAYS[index]} ${money(value)}`).join(", ")}`}>
            {earnings.weeklyTrend.map((value, index) => <div key={DAYS[index]} className="flex h-full min-w-0 flex-col justify-end text-center"><span className="mb-2 text-sm font-medium text-navy">${value}</span><div className={`w-full rounded-t-lg ${value === maximum ? "bg-accent" : "bg-navy/80"}`} style={{ height: `${Math.max((value / maximum) * 155, 3)}px` }} /><span className="mt-3 text-sm text-navy/60">{DAYS[index]}</span></div>)}
          </div>
          <p className="mt-6 border-t border-navy/10 pt-4 text-sm leading-6 text-navy/60">This chart shows example order sales, not settled funds. Real reporting will distinguish payments, refunds, disputes, processor fees, and payouts.</p>
        </section>
        <section className="panel">
          <div className="section-heading"><h2>From sales to proceeds</h2></div>
          <ol className="mt-5 space-y-5">
            {[["Order sales", "The accepted production and delivery amount."], ["Adjustments and costs", "Refunds, processor costs, and any agreed marketplace commission."], ["Net proceeds", "Reconciled from actual provider records, with tax treatment confirmed."]].map(([title, detail], index) => <li key={title} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/5 text-sm font-semibold text-accent">{index + 1}</span><div><h3 className="font-semibold text-navy">{title}</h3><p className="mt-1 text-sm leading-6 text-navy/65">{detail}</p></div></li>)}
          </ol>
          <div className="mt-6 rounded-xl bg-navy p-4 text-white"><CircleDollarSign size={23} className="text-orange-300" /><h3 className="mt-3 font-semibold">Payout setup is pending</h3><p className="mt-2 text-sm leading-6 text-white/75">Stripe-hosted seller onboarding and transaction reporting are not connected in this preview.</p><Link to="/account" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">View setup status <ArrowRight size={16} /></Link></div>
        </section>
      </div>
      <section className="panel"><div className="section-heading"><h2>Sample insights</h2></div><div className="mt-5 grid gap-5 sm:grid-cols-3">{[{ icon: Layers, value: earnings.topMaterial, label: "Most requested sample material" }, { icon: CircleDollarSign, value: earnings.busiestDay, label: "Highest sample sales day" }, { icon: Repeat2, value: `${earnings.repeatCustomerPct}%`, label: "Example repeat-buyer rate" }].map(({ icon: Icon, value, label }) => <div key={label} className="flex items-center gap-3"><div className="rounded-xl bg-navy/5 p-3 text-accent"><Icon size={22} /></div><div><p className="font-semibold text-navy">{value}</p><p className="mt-1 text-sm text-navy/60">{label}</p></div></div>)}</div></section>
    </div>
  );
}


