import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
export default function ScreenHeader({title,subtitle,onBack,right}) {const navigate=useNavigate();return <div className="section-row" style={{marginBottom:25}}><div style={{display:'flex',gap:14,alignItems:'center'}}><button className="icon-button" aria-label="Go back" onClick={onBack||(()=>navigate(-1))}><ArrowLeft size={19}/></button><div><h1 style={{fontSize:26,fontWeight:650}}>{title}</h1>{subtitle&&<p className="muted" style={{fontSize:14,marginTop:4}}>{subtitle}</p>}</div></div>{right}</div>}
