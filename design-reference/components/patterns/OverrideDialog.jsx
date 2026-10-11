import React from 'react';
import { Dialog } from '../overlays/Dialog.jsx';
import { Button } from '../buttons/Button.jsx';
import { Field } from '../forms/Field.jsx';
import { Textarea } from '../forms/Textarea.jsx';
import { Select } from '../forms/Select.jsx';
export function OverrideDialog({visible=true,title='Override with reason',description,reasons,destructive=false,confirmLabel='Confirm override',cancelLabel='Cancel',reasonLabel='Reason',auditNote='This action is recorded in the audit log.',onConfirm,onCancel,inline=false}){
const [r,setR]=React.useState('');const [note,setNote]=React.useState('');
const ok=reasons?!!r:note.trim().length>=3;
return <Dialog visible={visible} inline={inline} onHide={onCancel} header={title} width={460} footer={<><Button label={cancelLabel} severity="secondary" variant="text" onClick={onCancel}/><Button label={confirmLabel} severity={destructive?'danger':'primary'} disabled={!ok} onClick={()=>onConfirm&&onConfirm({reason:r,note})}/></>}><div style={{display:'flex',flexDirection:'column',gap:14}}>{description&&<div style={{color:'var(--text-secondary)'}}>{description}</div>}{reasons&&<Field label={reasonLabel} required><Select options={reasons} value={r} onChange={setR} placeholder="Choose a reason"/></Field>}<Field label={reasons?'Note':reasonLabel} required={!reasons}><Textarea value={note} onChange={setNote} rows={3} placeholder="Explain why"/></Field><div style={{display:'flex',gap:6,alignItems:'center',font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)'}}><i className="pi pi-shield" style={{fontSize:12}}></i>{auditNote}</div></div></Dialog>;}
