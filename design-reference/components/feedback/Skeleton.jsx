import React from 'react';
function injectCss(){if(typeof document==='undefined'||document.getElementById('sa-skel-css'))return;const s=document.createElement('style');s.id='sa-skel-css';s.textContent="@keyframes sa-skel{0%{background-position:100% 0}100%{background-position:-100% 0}}.sa-skel{display:block;background:linear-gradient(90deg,var(--surface-sunken) 25%,var(--border-default) 50%,var(--surface-sunken) 75%);background-size:200% 100%;animation:sa-skel 1.4s ease infinite}";document.head.appendChild(s);}

export function Skeleton({width='100%',height=14,shape='rect',radius,style}){
injectCss();
const r=shape==='circle'?'50%':radius??6;
return <span className="sa-skel" aria-hidden="true" style={{width:shape==='circle'?height:width,height,borderRadius:r,...style}}></span>;}
