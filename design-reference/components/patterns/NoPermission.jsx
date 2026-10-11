import React from 'react';
import { EmptyState } from './EmptyState.jsx';
export function NoPermission({lang='en',action,style}){
const ar=lang==='ar';
return <EmptyState icon="pi-lock" title={ar?'لا تملك صلاحية الوصول':'No access'} description={ar?'ليس لديك صلاحية للوصول إلى هذه الصفحة. اطلب ذلك من المسؤول.':"You don't have access to this. Ask your administrator."} action={action} style={style}/>;}
