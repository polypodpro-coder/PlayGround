import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { Layers3, Search, Box, ClipboardList, Factory, UserRound } from 'lucide-react';
import { useApp } from './context/AppContext';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
const HomeFeed = lazy(() => import('./pages/buyer/HomeFeed'));
const ShopProfile = lazy(() => import('./pages/buyer/ShopProfile'));
const DesignDetail = lazy(() => import('./pages/buyer/DesignDetail'));
const CreationStudio = lazy(() => import('./pages/buyer/CreationStudio'));
const CreationInbox = lazy(() => import('./pages/owner/CreationInbox'));
const RequestUpload = lazy(() => import('./pages/buyer/RequestUpload'));
const Quotes = lazy(() => import('./pages/buyer/Quotes'));
const Checkout = lazy(() => import('./pages/buyer/Checkout'));
const OrderHistory = lazy(() => import('./pages/buyer/OrderHistory'));
const OrderTracking = lazy(() => import('./pages/buyer/OrderTracking'));
const Account = lazy(() => import('./pages/buyer/Account'));
const Dashboard = lazy(() => import('./pages/owner/Dashboard'));
const Requests = lazy(() => import('./pages/owner/Requests'));
const JobDetail = lazy(() => import('./pages/owner/JobDetail'));
const Earnings = lazy(() => import('./pages/owner/Earnings'));
const PrinterSettings = lazy(() => import('./pages/owner/PrinterSettings'));
const TrustCenter = lazy(() => import('./pages/TrustCenter'));
const navigation = [{to:'/',label:'Discover',icon:Search},{to:'/request',label:'New request',icon:Box},{to:'/orders',label:'Orders',icon:ClipboardList},{to:'/owner',label:'Print farm',icon:Factory},{to:'/account',label:'Account',icon:UserRound}];
export default function App() {
 const {toast,hideToast}=useApp(); const {pathname}=useLocation(); const previousPath=useRef(pathname);
 useEffect(()=>{
  const page = pathname === '/' ? 'Discover' : pathname.startsWith('/create') ? 'Creation studio' : pathname.startsWith('/owner/creations') ? 'Creation inbox' : pathname.startsWith('/owner/requests/') ? 'Quote workspace' : pathname.startsWith('/owner/requests') ? 'Farm requests' : pathname.startsWith('/owner/settings') ? 'Farm settings' : pathname.startsWith('/owner/earnings') ? 'Farm earnings' : pathname.startsWith('/owner') ? 'Farm overview' : pathname.startsWith('/request') ? 'Configure a part' : pathname.startsWith('/quotes') ? 'Compare quotes' : pathname.startsWith('/checkout') ? 'Review sample order' : pathname.startsWith('/orders/') ? 'Order progress' : pathname.startsWith('/orders') ? 'Orders' : pathname.startsWith('/shop/') ? 'Print farm' : pathname.startsWith('/design/') ? 'Design concept' : pathname.startsWith('/trust') ? 'Trust center' : ['/account','/login','/signup'].includes(pathname) ? 'Account' : 'Page not found';
  document.title = page + ' | Poly Pod Pro';
  if(previousPath.current !== pathname){window.scrollTo({top:0,behavior:'instant'});document.getElementById('main-content')?.focus({preventScroll:true});previousPath.current=pathname;}
 },[pathname]);
 return <div className="app-shell">
  <a href="#main-content" className="skip-link" onClick={(event)=>{event.preventDefault();document.getElementById("main-content")?.focus();}}>Skip to content</a>
  <header className="site-header"><div className="header-inner"><Link to="/" className="brand" aria-label="Poly Pod Pro home"><span className="brand-mark"><Layers3 size={23}/></span>Poly Pod<span style={{fontWeight:400,color:'#6d808b'}}>Pro</span></Link><nav className="primary-nav" aria-label="Main navigation">{navigation.map(({to,label})=><NavLink key={to} to={to} end={to==='/'}>{label}</NavLink>)}</nav></div></header>
  <div className="preview-strip"><span className="preview-dot"/>Marketplace preview · Sample farms and orders. Creation Studio shows its separate sharing status. No payments are taken.</div>
  <main className="app-main" id="main-content" tabIndex={-1}>{pathname.startsWith("/owner") && <nav className="farm-navigation" aria-label="Farm navigation">{[{to:"/owner",label:"Overview"},{to:"/owner/requests",label:"Requests"},{to:"/owner/creations",label:"Creations"},{to:"/owner/earnings",label:"Earnings"},{to:"/owner/settings",label:"Settings"}].map(({to,label})=><NavLink key={to} to={to} end={to==="/owner"}>{label}</NavLink>)}</nav>}<ErrorBoundary key={pathname}><Suspense fallback={<div className="empty-state" role="status">Loading workspace…</div>}><Routes>
   <Route path="/" element={<HomeFeed/>}/><Route path="/shop/:printerId" element={<ShopProfile/>}/><Route path="/design/:designId" element={<DesignDetail/>}/><Route path="/create" element={<CreationStudio/>}/><Route path="/request" element={<RequestUpload/>}/><Route path="/quotes" element={<Quotes/>}/><Route path="/checkout" element={<Checkout/>}/><Route path="/orders" element={<OrderHistory/>}/><Route path="/orders/:orderId" element={<OrderTracking/>}/><Route path="/account" element={<Account/>}/><Route path="/login" element={<Account/>}/><Route path="/signup" element={<Account/>}/>
   <Route path="/owner" element={<Dashboard/>}/><Route path="/owner/creations" element={<CreationInbox/>}/><Route path="/owner/requests" element={<Requests/>}/><Route path="/owner/requests/:jobId" element={<JobDetail/>}/><Route path="/owner/earnings" element={<Earnings/>}/><Route path="/owner/settings" element={<PrinterSettings/>}/><Route path="/trust" element={<TrustCenter/>}/>
   <Route path="*" element={<div className="not-found"><span className="eyebrow">404</span><h1 className="page-heading">This page moved off the print bed.</h1><Link className="button" to="/">Back to discover</Link></div>}/>
  </Routes></Suspense></ErrorBoundary></main>
  <footer className="site-footer"><div className="footer-inner"><span>© {new Date().getFullYear()} Poly Pod Pro · Made for independent makers.</span><div className="footer-links"><Link to="/trust">Trust &amp; marketplace policies</Link><Link to="/create">Creation studio</Link><Link to="/account">Account setup</Link></div></div></footer>
  <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==='/'}><Icon size={20}/>{label}</NavLink>)}</nav><Toast toast={toast} onClose={hideToast}/>
 </div>;
}



