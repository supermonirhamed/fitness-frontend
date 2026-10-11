import React from 'react';
import { Drawer } from '../overlays/Drawer.jsx';
import { Button } from '../buttons/Button.jsx';
export function EntityDrawer({visible=true,title,subtitle,children,onCancel,onSave,saveLabel='Save',cancelLabel='Cancel',saving=false,saveDisabled=false,footerStart,width,inline=false}){
return <Drawer visible={visible} onHide={onCancel} header={title} subheader={subtitle} width={width} inline={inline} footer={<>{footerStart&&<div style={{marginInlineEnd:'auto'}}>{footerStart}</div>}<Button label={cancelLabel} severity="secondary" variant="text" onClick={onCancel}/><Button label={saveLabel} loading={saving} disabled={saveDisabled} onClick={onSave}/></>}><div style={{display:'flex',flexDirection:'column',gap:16}}>{children}</div></Drawer>;}
