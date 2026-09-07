import { createContext,useCallback,useContext,useMemo,useRef,useState } from 'react';
import { orders as sampleOrders,quotes as sampleQuotes,printers as samplePrinters,users as sampleUsers,savedAddresses, MATERIAL_MULTIPLIERS,POST_PROCESSING_ADDONS,MY_PRINTER_ID } from '../data/mockData';
import { buildPreviewQuotes, requireCurrentPreviewQuote } from '../lib/previewQuotes';
import { sampleOrderAmounts } from '../lib/sampleOrderAmounts';
const AppContext=createContext(null);
export function AppProvider({children}) {
 const [role,setRole]=useState('buyer'); const [currentUser,setCurrentUser]=useState({...sampleUsers[0],name:'Sample buyer',email:'buyer@example.com',credits:0});
 const [request,assignRequest]=useState(null),[selectedQuote,setSelectedQuote]=useState(null),[directRequestPrinterId,setDirectRequestPrinterId]=useState(null),[selectedDesign,setSelectedDesign]=useState(null);
 const [orders,setOrders]=useState(sampleOrders),[printers,setPrinters]=useState(samplePrinters),[favorites,setFavorites]=useState(new Set()),[addresses,setAddresses]=useState(savedAddresses),[paymentMethods,setPaymentMethods]=useState([]),[toast,setToast]=useState(null);
 const [selectedMaterial,setSelectedMaterial]=useState('PETG'),[selectedMachineId,setSelectedMachineId]=useState('bambu-x1c'),[selectedAddons,setSelectedAddons]=useState([]);const timer=useRef(null);
 const setRequest=useCallback(next=>{assignRequest(next ? {...next,selectedAddons:[...(next.selectedAddons||[])]} : null);setSelectedQuote(null)},[]);
 const showToast=useCallback((message,type='info',duration=3500)=>{clearTimeout(timer.current);setToast({message,type});timer.current=setTimeout(()=>setToast(null),duration)},[]);
 const hideToast=useCallback(()=>{clearTimeout(timer.current);setToast(null)},[]);
 const quickLogin=useCallback(next=>{setRole(next);setCurrentUser({...sampleUsers.find(u=>u.role===next),name:next==='owner'?'Sample farm owner':'Sample buyer',email:'preview@example.com'})},[]);
 const toggleRole=useCallback(()=>setRole(v=>v==='buyer'?'owner':'buyer'),[]);
 const toggleAddon=useCallback(id=>setSelectedAddons(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]),[]);
 const toggleFavorite=useCallback(id=>setFavorites(v=>{const n=new Set(v);if(n.has(id))n.delete(id);else n.add(id);return n}),[]);
 const updateCurrentUser=useCallback(patch=>setCurrentUser(v=>({...v,...patch})),[]);
 const updateOrder=useCallback((id,patch)=>setOrders(v=>v.map(o=>o.id===id?{...o,...patch}:o)),[]);
 const updatePrinter=useCallback((id,patch)=>setPrinters(v=>v.map(p=>p.id===id?{...p,...patch}:p)),[]);
 const myShop=printers.find(p=>p.id===MY_PRINTER_ID);
 const updateMyShop=useCallback(patch=>updatePrinter(MY_PRINTER_ID,patch),[updatePrinter]);
 const quotes=useMemo(()=>buildPreviewQuotes({request,farms:printers,templates:sampleQuotes,materials:MATERIAL_MULTIPLIERS,addons:POST_PROCESSING_ADDONS}),[request,printers]);
 const acceptQuote=useCallback(quote=>setSelectedQuote(requireCurrentPreviewQuote(quote,quotes)),[quotes]);
 const placeOrder=useCallback((extra={})=>{
  if(!request)throw new Error('Configure a sample request before creating an order.');
  const quote=requireCurrentPreviewQuote(selectedQuote,quotes);
  const amounts=sampleOrderAmounts(quote,extra.deliveryMethod,extra.tipPercent ?? 0);
  const id='demo-'+crypto.randomUUID();
  const next={...extra,...amounts,id,printerId:quote.printerId,status:'queued',progressPct:0,etaLabel:'Sample order created',printCost:quote.price,serviceFee:0,material:quote.material,color:quote.color||'As specified',machineId:quote.machineId,addons:[...(quote.addons||[])],createdAt:new Date().toISOString(),messages:[],viewed:false,rated:false,
   fileName:request.fileName||'Sample design',quantity:quote.quantity,sourceType:request.sourceType||'sample',isPreview:true,paymentStatus:'not_collected'};
  setOrders(v=>[next,...v]);setSelectedQuote(null);setDirectRequestPrinterId(null);setSelectedDesign(null);return id;
 },[request,selectedQuote,quotes]);
 const rateOrder=useCallback((id,printerId,{rating,text})=>{if(!Number.isInteger(rating)||rating<1||rating>5)return;setOrders(v=>v.map(o=>o.id===id?{...o,rated:true}:o));setPrinters(v=>v.map(p=>p.id===printerId?{...p,reviews:[{id:crypto.randomUUID(),buyerName:'Sample buyer',rating,text:String(text).slice(0,2000),date:new Date().toISOString()},...(p.reviews||[])]}:p));},[]);
 const quoteBreakdown=useMemo(()=>{const grams=request?.estimatedGrams||40,quantity=request?.quantity||1,material=request?.material||'PETG',mat=MATERIAL_MULTIPLIERS[material]||MATERIAL_MULTIPLIERS.PETG;const activeAddons=POST_PROCESSING_ADDONS.filter(a=>(request?.selectedAddons||[]).includes(a.id));const addonCost=activeAddons.reduce((s,a)=>s+a.cost,0)*quantity;const baseCost=grams*mat.rate*quantity;const subtotal=baseCost+addonCost;return {grams,quantity,material,materialRate:mat.rate,materialCategory:mat.category,materialMultiplier:mat.multiplier,baseCost,addonCost,activeAddons,subtotal,low:Math.max(8,Math.round(subtotal)),high:Math.max(10,Math.round(subtotal*1.3)),machineId:request?.selectedMachineId||null}},[request]);
 const value={role,setRole,toggleRole,currentUser,isAuthenticated:false,isPreview:true,quickLogin,login:()=>showToast('Real sign-in is available only through the configured account provider.'),signup:()=>showToast('Registration is not open.'),logout:()=>setCurrentUser(null),updateCurrentUser,request,setRequest,directRequestPrinterId,setDirectRequestPrinterId,selectedDesign,setSelectedDesign,quotes,selectedQuote,acceptQuote,orders,updateOrder,placeOrder,rateOrder,activeOrderCount:orders.filter(o=>!['completed','cancelled'].includes(o.status)).length,printers,updatePrinter,myShop,updateMyShop,favorites,toggleFavorite,addresses,addAddress:(label,line)=>setAddresses(v=>[...v,{id:crypto.randomUUID(),label,line}]),removeAddress:id=>setAddresses(v=>v.filter(a=>a.id!==id)),paymentMethods,addPaymentMethod:()=>showToast('Payment details are not collected in the preview.'),removePaymentMethod:id=>setPaymentMethods(v=>v.filter(p=>p.id!==id)),toast,showToast,hideToast,selectedMaterial,setSelectedMaterial,selectedMachineId,setSelectedMachineId,selectedAddons,toggleAddon,quoteBreakdown};
 return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
// oxlint-disable-next-line react/only-export-components -- Shared context hook is intentionally exported with its provider.
export function useApp(){const value=useContext(AppContext);if(!value)throw new Error('useApp requires AppProvider');return value;}



