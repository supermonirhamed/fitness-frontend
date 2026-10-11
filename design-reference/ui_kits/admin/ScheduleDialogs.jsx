function EditScopeDialog({session,onCancel,onSaved}){
  const [t]=useT();const s=session;
  const [scope,setScope]=React.useState('one');const [start,setStart]=React.useState(s.start);const [cap,setCap]=React.useState(s.cap);
  const timeChanged=start!==s.start;const n={one:1,following:8,all:11}[scope];
  const over=cap<s.booked;
  const blocked=[{d:t('Tue 7 Oct','الثلاثاء 7 أكتوبر'),b:s.booked},...(scope!=='one'?[{d:t('Sun 12 Oct','الأحد 12 أكتوبر'),b:14},{d:t('Tue 14 Oct','الثلاثاء 14 أكتوبر'),b:13}]:[])].filter(x=>x.b>cap);
  return <SA.Dialog header={t('Edit recurring session','تعديل حصة متكررة')} onHide={onCancel} width={540} footer={<><SA.Button label={t('Cancel','إلغاء')} variant="text" severity="secondary" onClick={onCancel}/><SA.Button label={t('Save changes','حفظ التغييرات')} disabled={over} onClick={()=>onSaved({scope,start,cap})}/></>}>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{font:'var(--text-small)',color:'var(--text-secondary)'}}><i className="pi pi-replay" style={{marginInlineEnd:6}}></i>{t('Part of: Sun/Tue 18:00, until 31 Jan','جزء من: الأحد/الثلاثاء 18:00، حتى 31 يناير')}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Start time','وقت البدء')}><SA.DatePicker mode="time" value={start} onChange={setStart}/></SA.Field><SA.Field label={t('Capacity','السعة')} error={over?t('Lower than existing bookings','أقل من الحجوزات الحالية'):null}><SA.InputNumber value={cap} onChange={v=>setCap(v||0)} invalid={over} showButtons/></SA.Field></div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}><span style={{font:'var(--text-small)',fontWeight:500}}>{t('Apply to','تطبيق على')}</span>
        <SA.RadioButton name="scope" value="one" checked={scope==='one'} onChange={setScope} label={t('This session only','هذه الحصة فقط')} description={t('Other sessions in the series stay as they are.','تبقى باقي حصص السلسلة كما هي.')}/>
        <SA.RadioButton name="scope" value="following" checked={scope==='following'} onChange={setScope} label={t('This and following','هذه والحصص التالية')} description={t('Earlier sessions keep the old details.','تحتفظ الحصص السابقة بالتفاصيل القديمة.')}/>
        <SA.RadioButton name="scope" value="all" checked={scope==='all'} onChange={setScope} label={t('All in series','كل حصص السلسلة')} description={t('Past sessions are not changed.','لا تتغير الحصص الماضية.')}/>
      </div>
      {over?<SA.Message severity="danger" icon="pi-ban" title={t("Can't reduce capacity below existing bookings",'لا يمكن تقليل السعة لأقل من الحجوزات الحالية')}><div style={{display:'flex',flexDirection:'column',gap:4,marginTop:4}}>{blocked.map((b,i)=><span key={i}>{b.d} · <b className="num">{b.b}</b> {t('booked','محجوز')}</span>)}</div></SA.Message>
      :timeChanged?<SA.Message severity="info" icon="pi-bell">{t(n+' future session'+(n>1?'s have':' has')+' bookings; clients will be notified of the time change.',n+' حصة قادمة فيها حجوزات؛ سيتم إشعار العملاء بتغيير الوقت.')}</SA.Message>:null}
    </div>
  </SA.Dialog>;
}
function CancelSessionDialog({session,onCancel,onConfirm}){
  const [t,lang]=useT();const s=session;
  const [reason,setReason]=React.useState('');const [note,setNote]=React.useState('');const [scope,setScope]=React.useState('one');const [range,setRange]=React.useState(['2026-10-07','2026-10-21']);
  const mult={one:1,following:8,range:5}[scope];
  return <SA.Dialog header={t('Cancel session','إلغاء الحصة')} onHide={onCancel} width={520} footer={<><SA.Button label={t('Keep session','إبقاء الحصة')} variant="text" severity="secondary" onClick={onCancel}/><SA.Button label={scope==='one'?t('Cancel session','إلغاء الحصة'):t('Cancel '+mult+' sessions','إلغاء '+mult+' حصص')} severity="danger" disabled={!reason} onClick={()=>onConfirm({scope,reason})}/></>}>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <SA.Message severity="danger" icon="pi-exclamation-triangle">{t((s.booked*mult)+' bookings and '+(s.wait*mult)+' waitlist entries will be cancelled. Credits are returned. Clients will be notified.',(s.booked*mult)+' حجزًا و'+(s.wait*mult)+' من قائمة الانتظار سيتم إلغاؤها. تُعاد الأرصدة ويتم إشعار العملاء.')}</SA.Message>
      <SA.Field label={t('Reason','السبب')} required><SA.Select value={reason} onChange={setReason} placeholder={t('Choose a reason','اختر سببًا')} options={[{label:t('Coach unavailable','المدرب غير متاح'),value:'coach'},{label:t('Facility issue','مشكلة في المرفق'),value:'facility'},{label:t('Low bookings','حجوزات قليلة'),value:'low'},{label:t('Holiday / closure','عطلة / إغلاق'),value:'holiday'},{label:t('Other','أخرى'),value:'other'}]}/></SA.Field>
      <SA.Field label={t('Note to clients','ملاحظة للعملاء')}><SA.Textarea rows={2} value={note} onChange={setNote} placeholder={t('Optional','اختياري')}/></SA.Field>
      <div style={{display:'flex',flexDirection:'column',gap:10}}><span style={{font:'var(--text-small)',fontWeight:500}}>{t('This session is part of a series','هذه الحصة جزء من سلسلة')}</span>
        <SA.RadioButton name="cscope" value="one" checked={scope==='one'} onChange={setScope} label={t('This session only','هذه الحصة فقط')}/>
        <SA.RadioButton name="cscope" value="following" checked={scope==='following'} onChange={setScope} label={t('This and following','هذه والحصص التالية')}/>
        <SA.RadioButton name="cscope" value="range" checked={scope==='range'} onChange={setScope} label={t('Date range','فترة محددة')}/>
        {scope==='range'&&<SA.DatePicker mode="range" value={range} onChange={setRange} locale={lang}/>}
      </div>
    </div>
  </SA.Dialog>;
}
function SubstituteCoachDrawer({session,onClose,onSaved}){
  const [t]=useT();const [pick,setPick]=React.useState(null);const [notify,setNotify]=React.useState(true);
  const list=[{id:'reem',ok:true,sub:t('Eligible · free 18:00–19:00','مؤهلة · متاحة 18:00–19:00')},{id:'noura',ok:false,current:true,sub:t('Current coach','المدرب الحالي')},{id:'khalid',ok:false,sub:t('Busy · Strength Basics 17:00–18:00 → overlaps','مشغول · أساسيات القوة 17:00–18:00')},{id:'faisal',ok:false,sub:t('Not qualified for this service','غير مؤهل لهذه الخدمة')}];
  return <SA.EntityDrawer title={t('Substitute coach','مدرب بديل')} subtitle={sessName(session,t)+' · 18:00'} onCancel={onClose} cancelLabel={t('Cancel','إلغاء')} saveLabel={t('Assign coach','تعيين المدرب')} saveDisabled={!pick} onSave={()=>onSaved(pick,notify)}>
    <div style={{display:'flex',flexDirection:'column',gap:6}}>{list.map(c=>{const co=KIT.coaches[c.id];const on=pick===c.id;return <label key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:8,border:'1px solid '+(on?'var(--primary)':'var(--border-default)'),background:on?'var(--primary-subtle)':c.ok?'var(--surface-card)':'var(--surface-sunken)',cursor:c.ok?'pointer':'not-allowed',opacity:c.ok?1:.75}}><input type="radio" name="sub" disabled={!c.ok} checked={on} onChange={()=>setPick(c.id)} style={{accentColor:'var(--primary)'}}/><SA.PersonChip name={t(co.en,co.ar)} secondary={<span style={{color:c.ok?'var(--sev-success-fg)':'var(--text-muted)'}}>{c.sub}</span>} style={{flex:1}}/>{c.ok&&<SA.Tag size="sm" severity="success">{t('Free','متاح')}</SA.Tag>}</label>;})}</div>
    <SA.ToggleSwitch checked={notify} onChange={setNotify} label={t('Notify booked clients','إشعار العملاء المحجوزين')} description={t(session.booked+' clients will get a message about the coach change.',session.booked+' عميلًا سيصلهم إشعار بتغيير المدرب.')}/>
  </SA.EntityDrawer>;
}
Object.assign(window,{EditScopeDialog,CancelSessionDialog,SubstituteCoachDrawer});
