import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, CircleUserRound, CreditCard, Factory, Fingerprint, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { getPlatformStatus, getSession, startSignIn, startSignOut } from "../../services/platformApi";

import { API_ENABLED as apiEnabled } from "../../config/runtime";
const PROPOSED_SETUP = [
  { title: "Hosted sign-in", detail: "Auth0 is the selected account provider. Passwords are entered only on its hosted login page.", icon: Fingerprint },
  { title: "Hosted payments", detail: "Stripe is the selected payment provider. Card and bank details belong in provider-hosted forms.", icon: CreditCard },
  { title: "Seller onboarding", detail: "Farm identity and payout eligibility need provider review before live orders can open.", icon: Factory },
];

export default function Account() {
  const navigate = useNavigate();
  const { role, quickLogin } = useApp();
  const [remote, setRemote] = useState({ loading: apiEnabled, status: null, session: null, error: "" });
  const [checking, setChecking] = useState(0);
  const isFarm = role === "owner";

  useEffect(() => {
    if (!apiEnabled) return undefined;
    let active = true;
    Promise.all([getPlatformStatus(), getSession()]).then(([status, session]) => {
      if (active) setRemote({ loading: false, status, session, error: "" });
    }).catch(() => {
      if (active) setRemote({ loading: false, status: null, session: null, error: "Account services are temporarily unavailable. You can still explore the sample marketplace." });
    });
    return () => { active = false; };
  }, [checking]);

  const switchWorkspace = (nextRole) => {
    quickLogin(nextRole);
    navigate(nextRole === "owner" ? "/owner" : "/");
  };
  const identityReady = remote.status?.identityConfigured === true;
  const authenticated = remote.session?.authenticated === true;
  const restricted = authenticated && ["suspended","email_unverified"].includes(remote.session?.accountStatus);

  return (
    <div className="app-page stack">
      <header><p className="eyebrow">YOUR WORKSPACE</p><h1 className="page-heading">A place for every part of the process.</h1><p className="body-copy">Explore the buyer and print-farm experiences, and see how secure account setup will work.</p></header>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.25fr]">
        <div className="stack">
          <section className="panel">
            <div className="flex items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-navy text-white"><CircleUserRound size={32} /></div><div><span className="badge">Sample identity</span><h2 className="mt-2 text-xl font-semibold text-navy">{isFarm ? "Dana · Sample farm owner" : "Alex · Sample buyer"}</h2><p className="mt-1 text-sm text-navy/60">{isFarm ? "farm@example.com" : "buyer@example.com"}</p></div></div>
            <p className="mt-5 text-sm leading-6 text-navy/70">This persona lets you explore the app. It is not a registered account, and changing workspaces does not grant access to any real farm.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => switchWorkspace("buyer")} className={isFarm ? "button button-secondary" : "button"}><CircleUserRound size={17} /> Buyer preview</button><button type="button" onClick={() => switchWorkspace("owner")} className={isFarm ? "button" : "button button-secondary"}><Factory size={17} /> Farm preview</button></div>
          </section>

          <section className="panel">
            <div className="section-heading"><h2>Keep the essentials in one place</h2></div>
            <div className="divide-y divide-navy/10">{[
              { to: "/orders", title: "Orders and progress", detail: "Explore sample timelines and delivery updates." },
              { to: "/owner/settings", title: "Farm profile and settings", detail: "Try material rates, coverage, and sample fleet controls." },
              { to: "/owner/earnings", title: "Sales overview", detail: "See example sales and payout-readiness information." },
            ].map((item) => <Link key={item.to} to={item.to} className="flex items-center gap-4 py-4"><div className="flex-1"><h3 className="font-semibold text-navy">{item.title}</h3><p className="mt-1 text-sm leading-6 text-navy/65">{item.detail}</p></div><ArrowRight size={18} className="text-accent" /></Link>)}</div>
          </section>

          <section className="rounded-2xl bg-navy p-6 text-white"><LockKeyhole size={25} className="text-orange-300" /><h2 className="mt-4 text-xl font-semibold">Built around hosted account tools.</h2><p className="mt-3 text-sm leading-6 text-white/75">The public preview does not ask for personal addresses, card numbers, bank details, or passwords. Account and payment controls will become available as the managed services are connected.</p></section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="section-heading flex flex-wrap items-center justify-between gap-3"><h2>Account readiness</h2><span className="badge">{remote.loading ? "Checking services" : restricted ? "Account access restricted" : authenticated ? "Hosted session active" : identityReady ? "Hosted sign-in available" : "Setup pending"}</span></div>
            <div className="mt-5 space-y-6">{PROPOSED_SETUP.map(({ title, detail, icon: Icon }, index) => <div key={title} className="flex gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-accent"><Icon size={21} /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-navy">{title}</h3><span className="text-sm text-navy/60">{index === 0 && identityReady ? "Configured" : index === 1 && remote.status?.paymentsConfigured ? "Configured · transactions closed" : "Pending"}</span></div><p className="mt-2 text-sm leading-6 text-navy/65">{detail}</p></div></div>)}</div>
            {remote.error && <div role="alert" className="mt-5 rounded-xl bg-orange-50 p-4 text-sm leading-6 text-navy/75"><p>{remote.error}</p><button type="button" onClick={() => { setRemote((previous) => ({ ...previous, loading: true, error: "" })); setChecking((value) => value + 1); }} className="mt-3 font-semibold text-accent underline underline-offset-4">Retry service check</button></div>}
            {!apiEnabled && <p className="mt-6 rounded-xl bg-navy/5 p-4 text-sm leading-6 text-navy/70">This version is a public preview. Hosted sign-in and account management are not connected here.</p>}
            {identityReady && !authenticated && <button type="button" onClick={startSignIn} className="button mt-6 w-full"><Fingerprint size={18} /> Continue to hosted sign-in</button>}
            {authenticated && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><Check size={17} /> {restricted ? "Hosted account access restricted" : "Hosted account session active"}</p><p className="mt-2 text-sm leading-6 text-emerald-900">{restricted ? "This account cannot access commerce. You can still sign out of your hosted session below." : "This authenticated session is separate from the sample workspace. Live ordering and seller enrollment remain closed."}</p>{remote.session?.csrfToken && <button type="button" onClick={() => startSignOut(remote.session.csrfToken)} className="button button-secondary mt-4"><LogOut size={17} /> Sign out of hosted account</button>}</div>}
          </section>
          <section className="panel">
            <div className="section-heading"><h2 className="flex items-center gap-2"><ShieldCheck size={22} className="text-accent" /> Before live ordering</h2></div>
            <p className="mt-3 text-sm leading-6 text-navy/65">The US marketplace needs approved seller terms, privacy and refund policies, secure file handling, and verified transaction processing before accepting paid work.</p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-navy/75"><li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" /> Buyers review the farm, scope, delivery, and complete price before paying.</li><li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" /> Farms set their prices with processing costs included in their business costs.</li><li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" /> Manufacturing begins only after payment and file approval are confirmed.</li></ul>
          </section>
        </div>
      </div>
    </div>
  );
}



