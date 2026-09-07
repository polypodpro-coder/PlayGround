import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, Factory, ArrowRight, MapPin, Map } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getFulfillmentOptions } from '../../lib/fulfillment';

export default function ShopProfile() {
  const { printerId } = useParams();
  const navigate = useNavigate();
  const { printers, favorites, toggleFavorite, setDirectRequestPrinterId, setSelectedDesign } = useApp();
  const farm = printers.find((item) => item.id === printerId);
  if (!farm) return <div className="empty-state"><h1 className="page-heading">Farm not found</h1><Link className="button-secondary" to="/">Return to discover</Link></div>;
  const hasRadius = Number.isFinite(farm.serviceRadiusMi) && farm.serviceRadiusMi > 0;
  const mapPath = `/?view=map&farm=${encodeURIComponent(farm.id)}`;
  const paused = farm.shopPaused || farm.status === 'offline';
  const methods = getFulfillmentOptions(farm);

  return <div className="app-page stack">
    <Link to="/" className="muted text-sm">← All print farms</Link>
    <div className="page-intro">
      <div><span className="eyebrow">Sample independent print farm</span><h1 className="page-heading">{farm.name}</h1><p className="body-copy">{farm.bio}</p></div>
      <button type="button" className="button-secondary" aria-pressed={favorites.has(farm.id)} onClick={() => toggleFavorite(farm.id)}><Heart size={17} />{favorites.has(farm.id) ? 'Saved' : 'Save farm'}</button>
    </div>
    <div className="profile-grid">
      <div className="stack">
        <section className="panel stack" aria-labelledby="farm-service-area-title">
          <div className="section-row"><h2 id="farm-service-area-title" className="section-heading">Fulfillment & local coverage</h2><MapPin size={25} className="text-accent" /></div>
          {methods.length ? <ul className="space-y-3" aria-label="Offered sample fulfillment methods">{methods.map(method => <li key={method.id} className="rounded-xl border border-navy/10 p-4"><div className="flex flex-wrap justify-between gap-3"><strong className="text-sm">{method.label}</strong><span className="text-sm">${(method.feeCents / 100).toFixed(2)} / order · example</span></div><p className="mt-2 text-sm text-navy/65">{method.detail}</p></li>)}</ul> : <p className="notice">This sample farm has not enabled any fulfillment methods.</p>}
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl bg-navy/5 p-5">
            <div><p className="text-sm text-navy/60">Example service-area radius</p><p className="mt-2 text-3xl font-bold">{hasRadius ? `${farm.serviceRadiusMi} miles` : 'To be confirmed'}</p><p className="mt-1 text-xs text-navy/60">{hasRadius ? 'Around this sample farm’s map pin' : 'Ask the farm about local coverage'}</p></div>
            <Link to={mapPath} className="button-secondary" aria-label={`View ${farm.name} service area on the sample map`}><Map size={17} /> View service-area map</Link>
          </div>
          <p className="body-copy">Choose from this farm’s listed methods. Confirm the location, schedule, and final charges before a real order. A service circle does not add pickup or drop-off to the methods offered above.</p>
          <div className="notice">The circle represents sample geographic coverage. Actual pickup or drop-off eligibility requires farm confirmation; travel routes and availability may differ.</div>
        </section>
        <section className="panel stack" aria-labelledby="farm-capabilities-title">
          <div className="section-row"><h2 id="farm-capabilities-title" className="section-heading">Workshop capabilities</h2><Factory size={25} /></div>
          <div className="filter-row">{farm.materials.map((material) => <span className="chip" key={material}>{material}</span>)}</div>
          <div className="metric-grid">
            <div className="metric"><span className="muted text-xs">Sample turnaround</span><strong>{farm.turnaroundLabel}</strong></div>
            <div className="metric"><span className="muted text-xs">Build area, mm</span><strong style={{ fontSize: 16 }}>{farm.buildVolume.x} × {farm.buildVolume.y} × {farm.buildVolume.z}</strong></div>
            <div className="metric"><span className="muted text-xs">Sample distance</span><strong>{farm.distanceMi} mi</strong></div>
          </div>
          <p className="body-copy">Confirm material grade, dimensions, surface finish, and intended use with the seller before manufacturing. Equipment availability and tolerances are specific to each quote.</p>
        </section>
        <section className="panel stack" aria-labelledby="farm-feedback-title">
          <h2 id="farm-feedback-title" className="section-heading">Example feedback</h2>
          {(farm.reviews || []).slice(0, 2).map((review) => <div key={review.id}><p className="text-sm leading-relaxed">“{review.text}”</p><p className="muted mt-1 text-xs">{review.buyerName} · Illustrative review</p></div>)}
        </section>
      </div>
      <aside className="panel stack self-start">
        <span className="badge self-start">{paused ? 'Sample farm paused' : 'Preview only'}</span>
        <h2 className="section-heading">Have a part in mind?</h2>
        <p className="body-copy">Explore a quote with your material, quantity, and finishing preferences. Nothing will be sent to this sample farm.</p>
        {paused && <p className="notice">This example farm is currently paused or offline. Explore another farm for a sample request.</p>}
        {!methods.length && <p className="notice">A fulfillment method must be enabled before this farm can provide a sample quote.</p>}
        <button type="button" className="button" disabled={paused || !methods.length} onClick={() => { setDirectRequestPrinterId(farm.id); setSelectedDesign(null); navigate('/request'); }}>Prepare a sample request<ArrowRight size={17} /></button>
        <Link to={mapPath} className="button-secondary"><MapPin size={17} /> Explore local coverage</Link>
        <Link to="/trust" className="muted text-sm">How the marketplace will work →</Link>
      </aside>
    </div>
  </div>;
}

