import React from 'react';
export function formatMoney(amount,currency='SAR',locale='en'){return new Intl.NumberFormat(locale==='ar'?'ar-SA-u-nu-latn':'en-US',{style:'currency',currency,minimumFractionDigits:2}).format(amount||0);}
export function Money({amount,currency='SAR',locale='en',strike=false,strong=false,style}){
return <span style={{fontVariantNumeric:'tabular-nums',fontWeight:strong?600:'inherit',textDecoration:strike?'line-through':'none',unicodeBidi:'isolate',...style}}>{formatMoney(amount,currency,locale)}</span>;}
