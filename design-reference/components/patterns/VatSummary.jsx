import React from 'react';
import { Money } from './Money.jsx';
export function VatSummary({subtotal,vatRate=15,currency='SAR',locale='en',inclusive=false,labels}){
const L=labels||(locale==='ar'?{sub:'المجموع الفرعي',vat:'ضريبة القيمة المضافة',total:'الإجمالي'}:{sub:'Subtotal',vat:'VAT',total:'Total'});
const net=inclusive?subtotal/(1+vatRate/100):subtotal;const vat=net*vatRate/100;const total=net+vat;
const row={display:'flex',justifyContent:'space-between',gap:16,font:'var(--text-body)',color:'var(--text-secondary)'};
return <div style={{display:'flex',flexDirection:'column',gap:6}}><div style={row}><span>{L.sub}</span><Money amount={net} currency={currency} locale={locale}/></div><div style={row}><span>{L.vat} {vatRate}%</span><Money amount={vat} currency={currency} locale={locale}/></div><div style={{...row,paddingTop:8,borderTop:'1px solid var(--border-default)',color:'var(--text-primary)',fontWeight:600,fontSize:16}}><span>{L.total}</span><Money amount={total} currency={currency} locale={locale} strong/></div></div>;}
