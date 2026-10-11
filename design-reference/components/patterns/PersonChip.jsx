import React from 'react';
import { Avatar } from '../data/Avatar.jsx';
export function PersonChip({name,secondary,image,size='md',badge,trailing,onClick,style}){
const lg=size==='lg';
return <span onClick={onClick} style={{display:'inline-flex',alignItems:'center',gap:lg?12:10,minWidth:0,cursor:onClick?'pointer':'default',...style}}><Avatar name={name} image={image} size={lg?'lg':size==='sm'?'sm':'md'} badge={badge}/><span style={{display:'flex',flexDirection:'column',minWidth:0}}><span style={{font:(lg?'600 15px':'500 14px')+'/1.35 var(--font-sans)',color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name}</span>{secondary&&size!=='sm'&&<span style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{secondary}</span>}</span>{trailing}</span>;}
