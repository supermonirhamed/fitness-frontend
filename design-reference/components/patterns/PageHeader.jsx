import React from 'react';
import { Breadcrumb } from '../navigation/Breadcrumb.jsx';
import { Button } from '../buttons/Button.jsx';
import { Menu } from '../navigation/Menu.jsx';
export function PageHeader({breadcrumb,title,status,meta,primaryAction,actions,moreItems,style}){
const [open,setOpen]=React.useState(false);
return <header style={{display:'flex',flexDirection:'column',gap:8,...style}}>{breadcrumb&&<Breadcrumb items={breadcrumb}/>}<div style={{display:'flex',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}><div style={{flex:1,minWidth:240}}><div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><h1 style={{margin:0,font:'var(--text-h1)',color:'var(--text-primary)'}}>{title}</h1>{status}</div>{meta&&<div style={{display:'flex',flexWrap:'wrap',gap:'4px 16px',marginTop:6,font:'var(--text-small)',color:'var(--text-secondary)'}}>{meta}</div>}</div><div style={{display:'flex',gap:8,alignItems:'center'}}>{actions}{moreItems&&<span style={{position:'relative'}}><Button icon="pi-ellipsis-h" severity="secondary" variant="outlined" ariaLabel="More actions" onClick={()=>setOpen(!open)}/>{open&&<div style={{position:'absolute',top:'calc(100% + 4px)',insetInlineEnd:0,zIndex:30}} onClick={()=>setOpen(false)}><Menu items={moreItems}/></div>}</span>}{primaryAction}</div></div></header>;}
