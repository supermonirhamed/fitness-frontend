import React from 'react';
const SIZES={xs:20,sm:24,md:32,lg:40,xl:56,xxl:96};
const TONES=['primary','green','sky','amber','purple','red'];
function initials(n){if(!n)return '';const p=String(n).replace(/[^\p{L}\s-]/gu,'').trim().split(/[\s-]+/).filter(Boolean).map(w=>w.replace(/^(ال|Al)(?=\p{L}{2})/u,''));if(!p.length)return '';const last=p.length>1?p[p.length-1]:'';const ar=/[\u0600-\u06FF]/.test(p[0]);return ar?p[0][0]+(last?' '+last[0]:''):(p[0][0]+(last?last[0]:'')).toUpperCase();}
function tone(n){let h=0;for(const c of String(n||''))h=(h*31+c.charCodeAt(0))>>>0;return TONES[h%TONES.length];}
export function Avatar({name,image,icon,size='md',shape='circle',badge,style}){
const px=typeof size==='number'?size:SIZES[size];const t=tone(name);
const box={position:'relative',width:px,height:px,flex:'none',borderRadius:shape==='circle'?'50%':Math.round(px/4),display:'inline-flex',alignItems:'center',justifyContent:'center',background:image?'center/cover url('+image+')':'var(--'+t+'-100)',color:'var(--'+t+'-700)',font:'600 '+Math.round(px*.38)+'px/1 var(--font-sans)',...style};
return <span style={box} role="img" aria-label={name}>{!image&&(icon?<i className={'pi '+icon} style={{fontSize:px*.45}}></i>:initials(name))}{badge&&<span style={{position:'absolute',bottom:-1,insetInlineEnd:-1,width:Math.max(8,px*.28),height:Math.max(8,px*.28),borderRadius:'50%',background:'var(--sev-'+badge+'-solid)',border:'2px solid var(--surface-card)'}}></span>}</span>;}
