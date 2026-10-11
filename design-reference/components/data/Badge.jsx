import React from 'react';
export function Badge({value,severity='danger',dot=false,size='md',style}){
if(dot)return <span aria-hidden="true" style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'var(--sev-'+severity+'-solid)',...style}}></span>;
const h=size==='sm'?16:size==='lg'?24:20;
const solid=severity==='primary'?{background:'var(--primary)',color:'var(--text-on-primary)'}:{background:'var(--sev-'+severity+'-solid)',color:severity==='warn'?'var(--surface-950)':'#fff'};
return <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:h,height:h,padding:'0 6px',borderRadius:999,...solid,font:'600 '+(h>18?12:10)+'px/1 var(--font-sans)',fontVariantNumeric:'tabular-nums',...style}}>{value}</span>;}
