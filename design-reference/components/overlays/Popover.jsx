import React from 'react';
export function Popover({trigger,children,open:openProp,onOpenChange,placement='bottom-start',width=300,style}){
const [o,setO]=React.useState(false);const open=openProp??o;const set=v=>{setO(v);onOpenChange&&onOpenChange(v);};
const ref=React.useRef(null);
React.useEffect(()=>{if(!open)return;const h=e=>{if(ref.current&&!ref.current.contains(e.target))set(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[open]);
const end=placement.endsWith('end');const top=placement.startsWith('top');
return <span ref={ref} style={{position:'relative',display:'inline-flex'}}><span onClick={()=>set(!open)} style={{display:'inline-flex'}}>{trigger}</span>{open&&<div role="dialog" style={{position:'absolute',zIndex:30,[top?'bottom':'top']:'calc(100% + 6px)',[end?'insetInlineEnd':'insetInlineStart']:0,width,padding:14,background:'var(--surface-overlay)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',boxShadow:'var(--shadow-2)',font:'var(--text-body)',color:'var(--text-primary)',...style}}>{children}</div>}</span>;}
