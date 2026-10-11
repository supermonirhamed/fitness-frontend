import React from 'react';
export function Tag({value,children,severity='secondary',icon,rounded=false,strike=false,size='md',style}){
const sm=size==='sm';
return <span style={{display:'inline-flex',alignItems:'center',gap:4,height:sm?20:24,padding:sm?'0 6px':'0 8px',borderRadius:rounded?999:'var(--radius-xs)',background:'var(--sev-'+severity+'-bg)',color:'var(--sev-'+severity+'-fg)',font:'600 '+(sm?11:12)+'px/1 var(--font-sans)',whiteSpace:'nowrap',textDecoration:strike?'line-through':'none',...style}}>{icon&&<i className={'pi '+icon} style={{fontSize:sm?10:11}}></i>}{value??children}</span>;}
