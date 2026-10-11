import React from 'react';
import { Message } from '../feedback/Message.jsx';
import { Button } from '../buttons/Button.jsx';
export function WhyNotMessage({reason,detail,severity='warn',canOverride=false,overrideLabel='Override',onOverride,secondaryAction}){
return <Message severity={severity} icon={severity==='danger'?'pi-ban':'pi-lock'} title={reason} action={(canOverride||secondaryAction)&&<div style={{display:'flex',gap:6}}>{secondaryAction}{canOverride&&<Button size="sm" variant="outlined" severity={severity==='danger'?'danger':'warn'} label={overrideLabel} icon="pi-unlock" onClick={onOverride}/>}</div>}>{detail}</Message>;}
