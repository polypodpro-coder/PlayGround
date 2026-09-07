import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Search, Heart, MapPin, Factory, Box, LayoutGrid, Map } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PartIllustration from '../../components/PartIllustration';
import { featuredDesigns } from '../../data/mockData';
import { FULFILLMENT_METHODS, getFulfillmentOptions } from '../../lib/fulfillment';
const PrinterMapView = lazy(() => import('../../components/PrinterMapView'));

export default function HomeFeed() {
  const { printers, favorites, toggleFavorite, setDirectRequestPrinterId, setSelectedDesign } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState(''), [material, setMaterial] = useState('All materials'), [saved, setSaved] = useState(false), [fulfillment, setFulfillment] = useState('any');
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'map' ? 'map' : 'list', farmId = params.get('farm') || '';
  function setMapView(nextView, nextFarm = '') {
    const next = new URLSearchParams(params);
    if (nextView === 'map') next.set('view', 'map'); else next.delete('view');
    if (nextFarm) next.set('farm', nextFarm); else next.delete('farm');
    setParams(next, { preventScrollReset: true });
  }
  const materials = useMemo(() => ['All materials', ...new Set(printers.flatMap((farm) => farm.materials).sort())], [printers]);
  const filtered = useMemo(() => printers.filter((farm) =>
    (!saved || favorites.has(farm.id)) &&
    (material === 'All materials' || farm.materials.includes(material)) &&
    (fulfillment === 'any' || getFulfillmentOptions(farm).some((method) => method.id === fulfillment)) &&
    `${farm.name} ${farm.materials.join(' ')} ${farm.bio}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [printers, favorites, query, material, saved, fulfillment]);
  function newRequest() { setSelectedDesign(null); setDirectRequestPrinterId(null); navigate('/request'); }
  function clearFilters() { setQuery(''); setMaterial('All materials'); setSaved(false); setFulfillment('any'); }

  return <div className="app-page">
    <section className="home-lead">
      <div><p className="eyebrow" style={{ marginBottom: 15 }}>A better way to make it</p><h1>Your next idea.<br /><span style={{ color: '#c4491f' }}>Made layer by layer.</span></h1><p className="body-copy">Find the right print farm, explore materials, and turn a design into a clear manufacturing request.</p><div className="home-actions"><button type="button" className="button" onClick={newRequest}><Box size={17} />Start a print request<ArrowRight size={17} /></button><Link className="button-secondary" to="/create">Create with Meshy<ArrowUpRight size={17} /></Link></div></div>
      <div className="workbench"><span className="workbench-label">DESIGN STUDY / 001</span><PartIllustration /><span className="workbench-caption">FDM · LAYERED SURFACES · DECORATIVE CONCEPT</span></div>
    </section>
    <section aria-labelledby="farms-title">
      <div className="section-row"><div><p className="eyebrow" style={{ marginBottom: 7 }}>Find your manufacturing match</p><h2 className="section-heading" id="farms-title">Independent print farms</h2></div><span className="badge"><MapPin size={13} style={{ marginRight: 5 }} />Sample network · Springfield, IL</span></div>
      <div className="discovery-toolbar">
        <label className="search-field"><Search size={19} /><input aria-label="Search farms or materials" type="search" placeholder="Search farms, materials, specialties..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select className="chip" aria-label="Filter by material" value={material} onChange={(event) => setMaterial(event.target.value)}>{materials.map((name) => <option key={name}>{name}</option>)}</select>
        <label className="field w-full sm:w-auto"><span className="text-xs">Fulfillment preference</span><select value={fulfillment} onChange={(event) => setFulfillment(event.target.value)}><option value="any">Any method</option>{FULFILLMENT_METHODS.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
        <button type="button" className={'icon-button ' + (saved ? 'chip-active' : '')} aria-label="Show saved farms" aria-pressed={saved} onClick={() => setSaved(!saved)}><Heart size={18} /></button>
        <button type="button" className="button-secondary" aria-label={view === 'list' ? 'Show coverage map' : 'Show farm list'} onClick={() => setMapView(view === 'list' ? 'map' : 'list')}>{view === 'list' ? <Map size={18} /> : <LayoutGrid size={18} />}{view === 'list' ? 'Coverage map' : 'Farm list'}</button>
      </div>
      <p role="status" className="muted mb-4 text-xs">{filtered.length} sample {filtered.length === 1 ? 'farm' : 'farms'} · Offered methods and fees are examples; farms confirm actual arrangements.</p>
      {view === 'map' && filtered.length ? <Suspense fallback={<div className="empty-state" role="status">Loading sample map…</div>}><PrinterMapView key={filtered.map((farm) => farm.id).join(',')} printers={filtered} selectedFarmId={farmId} onSelectFarm={(id) => setMapView('map', id)} /></Suspense> : filtered.length ? <div className="farm-grid">{filtered.map((farm) => {
        const methods = getFulfillmentOptions(farm);
        return <article className="farm-card" key={farm.id}>
          <div className="farm-card-head"><span className="farm-icon"><Factory size={22} /></span><button type="button" className="icon-button" onClick={() => toggleFavorite(farm.id)} aria-label={`${favorites.has(farm.id) ? 'Unsave' : 'Save'} ${farm.name}`} aria-pressed={favorites.has(farm.id)}><Heart size={16} fill={favorites.has(farm.id) ? 'currentColor' : 'none'} /></button></div>
          <div><Link to={'/shop/' + farm.id}><h3>{farm.name}</h3></Link><p className="farm-meta"><MapPin size={12} />{farm.distanceMi} mi · Sample farm</p></div>
          <p className="body-copy">{farm.bio}</p>
          <Link to={'/?view=map&farm=' + farm.id} className="inline-flex items-center gap-2 text-sm font-semibold text-accent"><MapPin size={15} />{farm.serviceRadiusMi}-mile example service area<ArrowUpRight size={14} /></Link>
          <div className="rounded-lg bg-navy/5 p-3"><p className="mb-2 text-xs font-semibold">Offered fulfillment · preview</p>{methods.length ? <ul className="space-y-2 text-xs">{methods.map((method) => <li key={method.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span>{method.label}</span><span className="font-semibold">${(method.feeCents / 100).toFixed(2)} example</span></li>)}</ul> : <p className="text-xs text-navy/60">No fulfillment methods offered in this sample.</p>}</div>
          <div className="filter-row">{farm.materials.slice(0, 3).map((name) => <span className="badge" key={name}>{name}</span>)}{farm.materials.length > 3 && <span className="badge">+{farm.materials.length - 3}</span>}</div>
          <div className="farm-card-footer"><span className="muted">{farm.turnaroundLabel} example</span><Link to={'/shop/' + farm.id} className="inline-flex items-center gap-1 font-semibold">View farm<ArrowUpRight size={16} /></Link></div>
        </article>;
      })}</div> : <div className="empty-state"><h3>No farms match these filters.</h3><button type="button" className="button-secondary mt-4" onClick={clearFilters}>Clear filters</button></div>}
    </section>
    <section className="catalog-section"><div className="section-row"><div><p className="eyebrow" style={{ marginBottom: 7 }}>A little inspiration</p><h2 className="section-heading">Start with a concept</h2></div><span className="muted text-xs">Illustrative designs</span></div><div className="catalog-grid">{['d5', 'd2', 'd3'].map((id, index) => { const design = featuredDesigns.find((item) => item.id === id); return <Link to={'/design/' + id} className="design-tile" key={id}><div className="design-art"><PartIllustration kind={['planter', 'organizer', 'tile'][index]} label={design.name + ' concept'} /></div><div className="design-copy"><h3>{design.name}</h3><p className="muted text-sm">{design.category} · {design.defaultMaterial}</p></div></Link>; })}</div></section>
  </div>;
}

