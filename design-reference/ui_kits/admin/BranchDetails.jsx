const FAC_TYPES={room:['pi-box','Room','غرفة'],studio:['pi-objects-column','Studio','استوديو'],field:['pi-flag','Field','ملعب مفتوح'],pool:['pi-wave-pulse','Pool','مسبح'],gym:['pi-bolt','Gym area','منطقة الأجهزة'],court:['pi-stop','Court','ملعب'],other:['pi-map-marker','Other','أخرى']};
const FAC_ROWS=[{id:'studioA',type:'studio',name:{en:'Studio A',ar:'استوديو أ'},cap:20,svc:6,status:'active',subs:0},{id:'hall',type:'gym',name:{en:'Main hall',ar:'القاعة الرئيسية'},cap:25,svc:0,status:'active',subs:0},{id:'pool',type:'pool',name:{en:'Pool',ar:'المسبح'},cap:12,svc:3,status:'active',subs:6},{id:'court',type:'court',name:{en:'Court 2',ar:'الملعب 2'},cap:10,svc:2,status:'inactive',subs:0}];
const DAYS=[['sat','Saturday','السبت'],['sun','Sunday','الأحد'],['mon','Monday','الاثنين'],['tue','Tuesday','الثلاثاء'],['wed','Wednesday','الأربعاء'],['thu','Thursday','الخميس'],['fri','Friday','الجمعة']];
const panel={background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)'};
function HoursTab({toast}){
  const [t]=useT();
  const init=()=>Object.fromEntries(DAYS.map(([k])=>[k,k==='fri'?[['16:00','23:00']]:[['06:00','12:00'],['16:00','22:00']]]));
  const [h,setH]=React.useState(init);const [dirty,setDirty]=React.useState(false);
  const set=(d,v)=>{setH({...h,[d]:v});setDirty(true);};
  return <div style={panel}>
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:'1px solid var(--border-default)'}}><div style={{flex:1}}><div style={{font:'var(--text-h3)'}}>{t('Business hours','ساعات العمل')}</div><div style={{font:'var(--text-small)',color:'var(--text-secondary)'}}>{t('Sessions outside these hours show a warning.','تظهر الحصص خارج هذه الساعات بتحذير.')} <span dir="ltr" style={{fontWeight:600}}>AST · Asia/Riyadh</span></div></div>{dirty&&<SA.Button label={t('Save hours','حفظ الساعات')} onClick={()=>{setDirty(false);toast({summary:t('Business hours saved','تم حفظ ساعات العمل')});}}/>}</div>
    {DAYS.map(([k,en,ar])=>{const r=h[k];const open=r.length>0;return <div key={k} style={{display:'grid',gridTemplateColumns:'84px 44px minmax(0,1fr) 36px',gap:12,alignItems:'start',padding:'12px 16px',borderBottom:'1px solid var(--border-subtle)'}}>
      <div style={{font:'500 14px/36px var(--font-sans)'}}>{t(en,ar)}</div>
      <div style={{paddingTop:7}}><SA.ToggleSwitch checked={open} onChange={v=>set(k,v?[['09:00','17:00']]:[])}/></div>
      <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:0}}>{open?r.map((rg,i)=><div key={i} style={{display:'flex',flexWrap:'wrap',gap:4,alignItems:'center'}}><div dir="ltr" style={{flex:'none',display:'flex',gap:6,alignItems:'center'}}><SA.DatePicker mode="time" value={rg[0]} onChange={v=>{const n=r.map(x=>[...x]);n[i][0]=v;set(k,n);}} style={{width:104}}/><span style={{color:'var(--text-muted)'}}>–</span><SA.DatePicker mode="time" value={rg[1]} onChange={v=>{const n=r.map(x=>[...x]);n[i][1]=v;set(k,n);}} style={{width:104}}/></div>{r.length>1&&<SA.Button icon="pi-trash" variant="text" severity="secondary" size="sm" ariaLabel="Remove range" onClick={()=>set(k,r.filter((_,j)=>j!==i))}/>}{i===r.length-1&&<SA.Button icon="pi-plus" label={t('Add range','إضافة فترة')} variant="text" size="sm" onClick={()=>set(k,[...r,['18:00','22:00']])}/>}</div>):<div style={{font:'var(--text-small)',color:'var(--text-muted)',lineHeight:'36px'}}>{t('Closed all day','مغلق طوال اليوم')}</div>}</div>
      <SA.Button icon="pi-copy" ariaLabel={t('Copy to all days','نسخ لكل الأيام')} variant="text" severity="secondary" size="sm" style={{marginTop:3}} onClick={()=>{setH(Object.fromEntries(DAYS.map(([d])=>[d,r.map(x=>[...x])])));setDirty(true);toast({summary:t('Copied to all days','تم النسخ لكل الأيام'),severity:'info'});}}/>
    </div>;})}
  </div>;
}
function HolidaysTab({toast}){
  const [t,lang]=useT();
  const [list,setList]=React.useState([{label:{en:'National Day',ar:'اليوم الوطني'},dates:{en:'23 Sep 2026',ar:'23 سبتمبر 2026'},closed:true},{label:{en:'Ramadan hours',ar:'ساعات رمضان'},dates:{en:'18 Feb – 19 Mar 2027',ar:'18 فبراير – 19 مارس 2027'},closed:false,hours:'20:00–02:00'}]);
  const [drawer,setDrawer]=React.useState(false);const [impact,setImpact]=React.useState(false);const [mode,setMode]=React.useState('range');const [closed,setClosed]=React.useState(true);const [range,setRange]=React.useState(['2026-12-01','2026-12-03']);const [choice,setChoice]=React.useState('cancel');const [label,setLabel]=React.useState(t('Maintenance','صيانة'));
  const affected=KIT.sessions.slice(1,5);
  const finish=()=>{setImpact(false);setList([...list,{label:{en:label,ar:label},dates:{en:'1 – 3 Dec 2026',ar:'1 – 3 ديسمبر 2026'},closed:true}]);toast({summary:choice==='cancel'?t('Closure saved · 12 sessions cancelled','تم حفظ الإغلاق · إلغاء 12 حصة'):t('Closure saved · sessions kept','تم حفظ الإغلاق · الإبقاء على الحصص'),detail:choice==='cancel'?t('Clients were notified.','تم إشعار العملاء.'):null});};
  return <div style={panel}>
    <div style={{display:'flex',alignItems:'center',padding:'14px 16px',borderBottom:'1px solid var(--border-default)'}}><div style={{flex:1,font:'var(--text-h3)'}}>{t('Holidays & special hours','العطل والساعات الخاصة')}</div><SA.Button label={t('Add','إضافة')} icon="pi-plus" severity="secondary" onClick={()=>setDrawer(true)}/></div>
    {list.map((x,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:16,padding:'12px 16px',borderBottom:'1px solid var(--border-subtle)'}}><span style={{width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:x.closed?'var(--sev-danger-bg)':'var(--sev-warn-bg)',color:x.closed?'var(--sev-danger-fg)':'var(--sev-warn-fg)'}}><i className={'pi '+(x.closed?'pi-ban':'pi-clock')}></i></span><div style={{flex:1}}><div style={{font:'500 14px var(--font-sans)'}}>{t(x.label.en,x.label.ar)}</div><div style={{font:'var(--text-small)',color:'var(--text-secondary)'}}>{t(x.dates.en,x.dates.ar)}</div></div>{x.closed?<SA.Tag severity="danger">{t('Closed','مغلق')}</SA.Tag>:<SA.Tag severity="warn"><span dir="ltr">{x.hours}</span></SA.Tag>}<SA.Button icon="pi-ellipsis-v" variant="text" severity="secondary" size="sm" ariaLabel="Actions"/></div>)}
    {drawer&&<SA.EntityDrawer title={t('Add holiday or special hours','إضافة عطلة أو ساعات خاصة')} onCancel={()=>setDrawer(false)} cancelLabel={t('Cancel','إلغاء')} saveLabel={t('Save','حفظ')} onSave={()=>{setDrawer(false);if(closed)setImpact(true);else{setList([...list,{label:{en:label,ar:label},dates:{en:'1 – 3 Dec 2026',ar:'1 – 3 ديسمبر 2026'},closed:false,hours:'10:00–18:00'}]);toast({summary:t('Special hours saved','تم حفظ الساعات الخاصة')});}}}>
      <SA.Field label={t('Label','العنوان')} required><SA.InputText value={label} onChange={setLabel}/></SA.Field>
      <SA.Field label={t('Dates','التاريخ')}><SA.SelectButton value={mode} onChange={setMode} options={[{label:t('Single day','يوم واحد'),value:'date'},{label:t('Date range','فترة'),value:'range'}]}/></SA.Field>
      {mode==='range'?<SA.DatePicker mode="range" inline value={range} onChange={setRange} locale={lang}/>:<SA.DatePicker value="2026-12-01" locale={lang}/>}
      <SA.Field label={t('Hours','الساعات')}><SA.SelectButton value={closed?'closed':'custom'} onChange={v=>setClosed(v==='closed')} options={[{label:t('Closed','مغلق'),value:'closed'},{label:t('Custom hours','ساعات مخصصة'),value:'custom'}]}/></SA.Field>
      {!closed&&<div style={{display:'flex',gap:8,alignItems:'center'}}><SA.DatePicker mode="time" value="10:00" style={{width:130}}/><span>–</span><SA.DatePicker mode="time" value="18:00" style={{width:130}}/></div>}
    </SA.EntityDrawer>}
    <SA.Dialog visible={impact} header={t('12 sessions on these dates','12 حصة في هذه التواريخ')} onHide={()=>setImpact(false)} width={520} footer={<><SA.Button label={t('Back','رجوع')} variant="text" severity="secondary" onClick={()=>{setImpact(false);setDrawer(true);}}/><SA.Button label={choice==='cancel'?t('Save & cancel sessions','حفظ وإلغاء الحصص'):t('Save closure','حفظ الإغلاق')} severity={choice==='cancel'?'danger':'primary'} onClick={finish}/></>}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{color:'var(--text-secondary)'}}>{t('The branch will be closed 1 – 3 Dec. These sessions are scheduled during the closure:','سيكون الفرع مغلقًا من 1 إلى 3 ديسمبر. هذه الحصص مجدولة خلال الإغلاق:')}</div>
        <div style={{border:'1px solid var(--border-default)',borderRadius:8,maxHeight:180,overflow:'auto'}}>{affected.map((s,i)=><div key={s.id} style={{display:'flex',gap:12,alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--border-subtle)'}}><SA.TimeLabel date={t(['Tue 1 Dec','Tue 1 Dec','Wed 2 Dec','Thu 3 Dec'][i],['الثلاثاء 1 ديسمبر','الثلاثاء 1 ديسمبر','الأربعاء 2 ديسمبر','الخميس 3 ديسمبر'][i])} time={s.start} style={{fontSize:13,width:170}}/><span style={{flex:1,font:'var(--text-small)'}}>{sessName(s,t)}</span><span className="num" style={{font:'var(--text-caption)',color:'var(--text-muted)'}}>{s.booked} {t('booked','محجوز')}</span></div>)}<div style={{padding:'8px 12px',font:'var(--text-small)',color:'var(--text-muted)'}}>{t('+ 8 more','+ 8 أخرى')}</div></div>
        <SA.RadioButton name="impact" value="cancel" checked={choice==='cancel'} onChange={setChoice} label={t('Cancel these sessions','إلغاء هذه الحصص')} description={t('58 bookings are cancelled, credits returned, clients notified.','تُلغى 58 حجزًا وتُعاد الأرصدة ويتم إشعار العملاء.')}/>
        <SA.RadioButton name="impact" value="keep" checked={choice==='keep'} onChange={setChoice} label={t('Keep them','الإبقاء عليها')} description={t("Sessions stay as they are. You'll handle them one by one.",'تبقى الحصص كما هي وتتعامل معها واحدة واحدة.')}/>
      </div>
    </SA.Dialog>
  </div>;
}
function FacilityDrawer({fac,onClose,onSaved}){
  const [t]=useT();const f=fac||{};
  const [type,setType]=React.useState(f.type||'room');const [cap,setCap]=React.useState(f.cap||10);const [svc,setSvc]=React.useState(f.id==='pool'?['swim','aqua','kids']:[]);
  const [subs,setSubs]=React.useState(f.subs?Array.from({length:f.subs},(_,i)=>({name:t('Lane ','حارة ')+(i+1),cap:2})):[]);
  const subTotal=subs.reduce((a,s)=>a+(s.cap||0),0);
  return <SA.EntityDrawer title={fac?t('Edit facility','تعديل المرفق'):t('New facility','مرفق جديد')} subtitle={t('Olaya branch','فرع العليا')} onCancel={onClose} onSave={onSaved} cancelLabel={t('Cancel','إلغاء')} saveLabel={t('Save facility','حفظ المرفق')}>
    <SA.Field label={t('Name','الاسم')} required><SA.InputText value={f.name?t(f.name.en,f.name.ar):''}/></SA.Field>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      <SA.Field label={t('Type','النوع')} required><SA.Select value={type} onChange={setType} options={Object.entries(FAC_TYPES).map(([k,v])=>({label:t(v[1],v[2]),value:k,icon:v[0]}))}/></SA.Field>
      <SA.Field label={t('Capacity','السعة')} required help={t('Hard maximum for any session here.','حد أقصى لأي حصة هنا.')}><SA.InputNumber value={cap} onChange={setCap} unitLabel={t('people','شخص')} showButtons/></SA.Field>
    </div>
    <SA.Field label={t('Allowed services','الخدمات المسموحة')} help={svc.length?null:t('Empty = all services can use this facility.','فارغ = كل الخدمات يمكنها استخدام المرفق.')}><SA.MultiSelect value={svc} onChange={setSvc} placeholder={t('All services','كل الخدمات')} filter options={[{label:t('Kids Swim','سباحة أطفال'),value:'kids',color:'var(--svc-1)'},{label:t('Lap swim','سباحة حرة'),value:'swim',color:'var(--svc-2)'},{label:t('Aqua Fit','أكوا فت'),value:'aqua',color:'var(--svc-5)'},{label:t('Yoga Flow','يوغا فلو'),value:'yoga',color:'var(--svc-2)'}]}/></SA.Field>
    <SA.Field label={t('Description','الوصف')}><SA.Textarea rows={2}/></SA.Field>
    <SA.Field label={t('Photo','الصورة')}><SA.FileUpload variant="logo" label={t('Upload photo','رفع صورة')}/></SA.Field>
    <div style={{borderTop:'1px solid var(--border-default)',paddingTop:16,display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}><div style={{flex:1}}><div style={{font:'var(--text-h4)'}}>{t('Sub-areas','الأقسام الفرعية')}</div><div style={{font:'var(--text-small)',color:'var(--text-secondary)'}}>{t('For example lanes or half-courts, each with its own capacity.','مثل الحارات أو أنصاف الملاعب، لكلٍ سعته.')}</div></div><SA.Button size="sm" variant="outlined" icon="pi-plus" label={t('Add sub-area','إضافة قسم')} onClick={()=>setSubs([...subs,{name:t('Lane ','حارة ')+(subs.length+1),cap:2}])}/></div>
      {subs.map((s,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 140px 32px',gap:8,alignItems:'center'}}><SA.InputText value={s.name} onChange={v=>setSubs(subs.map((x,j)=>j===i?{...x,name:v}:x))}/><SA.InputNumber value={s.cap} onChange={v=>setSubs(subs.map((x,j)=>j===i?{...x,cap:v}:x))} unitLabel={t('cap.','سعة')}/><SA.Button icon="pi-trash" size="sm" variant="text" severity="secondary" ariaLabel="Remove" onClick={()=>setSubs(subs.filter((_,j)=>j!==i))}/></div>)}
      {subs.length>0&&subTotal>cap&&<SA.Message severity="warn">{t('Sub-areas add up to '+subTotal+', more than the facility capacity ('+cap+').','مجموع الأقسام '+subTotal+'، أكبر من سعة المرفق ('+cap+').')}</SA.Message>}
    </div>
  </SA.EntityDrawer>;
}
function FacilitiesTab({go,toast}){
  const [t,lang]=useT();const [edit,setEdit]=React.useState(null);
  const cols=[
    {field:'name',header:t('Facility','المرفق'),body:f=><div style={{display:'flex',alignItems:'center',gap:10}}><span style={{width:32,height:32,borderRadius:8,background:'var(--primary-subtle)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center'}}><i className={'pi '+FAC_TYPES[f.type][0]}></i></span><div><div style={{font:'500 14px var(--font-sans)'}}>{t(f.name.en,f.name.ar)}</div><div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)'}}>{t(FAC_TYPES[f.type][1],FAC_TYPES[f.type][2])}{f.subs?' · '+f.subs+t(' sub-areas',' أقسام'):''}</div></div></div>},
    {field:'cap',header:t('Capacity','السعة'),align:'end',body:f=><span className="num" style={{fontWeight:600}}>{f.cap}</span>},
    {field:'svc',header:t('Allowed services','الخدمات المسموحة'),body:f=>f.svc?<span className="num">{f.svc}</span>:<span style={{color:'var(--text-muted)'}}>{t('All','الكل')}</span>},
    {field:'status',header:t('Status','الحالة'),body:f=><SA.StatusTag status={f.status} lang={lang}/>}
  ];
  return <div style={{display:'flex',flexDirection:'column',gap:12}}>
    <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><SA.Button label={t('View availability','عرض التوفر')} icon="pi-calendar" severity="secondary" variant="outlined" onClick={()=>go('calendar')}/><SA.Button label={t('New facility','مرفق جديد')} icon="pi-plus" onClick={()=>setEdit({})}/></div>
    <SA.DataTable columns={cols} rows={FAC_ROWS} onRowClick={f=>setEdit(f)} rowActions={()=> <i className="pi pi-chevron-right pi-dir" style={{color:'var(--text-muted)',fontSize:12}}></i>}/>
    {edit&&<FacilityDrawer fac={edit.id?edit:null} onClose={()=>setEdit(null)} onSaved={()=>{setEdit(null);toast({summary:t('Facility saved','تم حفظ المرفق')});}}/>}
  </div>;
}
function VatTab({toast}){
  const [t,lang]=useT();
  const [on,setOn]=React.useState(true);const [rate,setRate]=React.useState(15);const [incl,setIncl]=React.useState('no');
  return <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.4fr) minmax(0,1fr)',gap:16,alignItems:'start'}}>
    <div style={{...panel,padding:'4px 24px 8px'}}>
      <SettingRow label={t('VAT enabled','تفعيل ضريبة القيمة المضافة')} help={t('Adds a tax line to prices and receipts at this branch.','يضيف سطر الضريبة للأسعار والإيصالات في هذا الفرع.')}><SA.ToggleSwitch checked={on} onChange={setOn} label={on?t('On','مفعّلة'):t('Off','متوقفة')}/></SettingRow>
      {on?<>
        <SettingRow label={t('Rate','النسبة')}><SA.InputNumber mode="percent" value={rate} onChange={setRate} decimals={0} style={{maxWidth:160}}/></SettingRow>
        <SettingRow label={t('Prices include VAT','الأسعار شاملة الضريبة')} help={incl==='yes'?t('A 115.00 price is 100.00 + 15.00 VAT.','سعر 115.00 = 100.00 + 15.00 ضريبة.'):t('VAT is added on top of the price.','تُضاف الضريبة فوق السعر.')}><SA.SelectButton value={incl} onChange={setIncl} options={[{label:t('No','لا'),value:'no'},{label:t('Yes','نعم'),value:'yes'}]}/></SettingRow>
        <SettingRow label={t('Tax registration number','الرقم الضريبي')}><SA.InputText dir="ltr" value="310 122 393 500 003" style={{fontFamily:'var(--font-mono)'}}/></SettingRow>
        <SettingRow label={t('Legal entity on receipts','الكيان القانوني في الإيصالات')}><SA.InputText value="شركة النخبة للياقة البدنية"/></SettingRow>
        <SettingRow label={t('Effective from','يسري من')} help={t('For rate changes. Bookings before this date keep the old rate.','عند تغيير النسبة. الحجوزات قبل هذا التاريخ تحتفظ بالنسبة القديمة.')}><SA.DatePicker value="2026-10-07" locale={lang}/></SettingRow>
      </>:<div style={{padding:'0 0 16px'}}><SA.Message severity="secondary">{t('VAT is off for this branch. Receipts show the total only, with no tax line.','الضريبة متوقفة لهذا الفرع. تعرض الإيصالات الإجمالي فقط دون سطر ضريبة.')}</SA.Message></div>}
    </div>
    <div style={{...panel,padding:16,display:'flex',flexDirection:'column',gap:12}}>
      <div style={{font:'var(--text-h4)'}}>{t('Receipt preview','معاينة الإيصال')}</div>
      {on?<SA.VatSummary subtotal={incl==='yes'?115:100} vatRate={rate} inclusive={incl==='yes'} locale={lang}/>:<div style={{display:'flex',justifyContent:'space-between',fontWeight:600,fontSize:16}}><span>{t('Total','الإجمالي')}</span><SA.Money amount={100} locale={lang} strong/></div>}
      <SA.Button label={t('Save VAT settings','حفظ إعدادات الضريبة')} onClick={()=>toast({summary:t('VAT settings saved','تم حفظ إعدادات الضريبة')})}/>
    </div>
  </div>;
}
function BranchDetails({id,go,toast}){
  const [t,lang]=useT();
  const base=allBranches().find(b=>b.id===id)||allBranches()[0];
  const [status,setStatus]=React.useState(base.status);const b={...base,status};
  const [tab,setTab]=React.useState('overview');const [edit,setEdit]=React.useState(false);const [deact,setDeact]=React.useState(false);
  const fact=(l,v)=><div><div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)'}}>{l}</div><div style={{font:'600 20px/1.4 var(--font-sans)'}} className="num">{v}</div></div>;
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <SA.PageHeader breadcrumb={[{label:t('Branches','الفروع'),onClick:e=>{e.preventDefault();go('branches');}},{label:t(b.name.en,b.name.ar)}]} title={t(b.name.en,b.name.ar)} status={<><SA.StatusTag status={b.status} lang={lang}/><span dir="ltr" style={{font:'600 11px/22px var(--font-sans)',padding:'0 6px',borderRadius:4,background:'var(--surface-sunken)',color:'var(--text-secondary)'}}><i className="pi pi-clock" style={{fontSize:10,marginInlineEnd:4}}></i>{b.tz} · {b.tzName}</span></>}
      meta={<span><i className="pi pi-map-marker" style={{fontSize:12,marginInlineEnd:4}}></i>{t(b.addr.en,b.addr.ar)}</span>}
      moreItems={[status==='active'?{label:t('Deactivate branch','إيقاف الفرع'),icon:'pi-power-off',danger:true,onClick:()=>setDeact(true)}:{label:t('Activate branch','تفعيل الفرع'),icon:'pi-check-circle',onClick:()=>{setStatus('active');toast({summary:t('Branch is now active','الفرع نشط الآن')});}},{label:t('Archive','أرشفة'),icon:'pi-inbox',disabled:status==='active',hint:t('Deactivate first','أوقف الفرع أولًا')}]}
      primaryAction={<SA.Button label={t('Edit','تعديل')} icon="pi-pencil" onClick={()=>setEdit(true)}/>}/>
    {status==='draft'&&<SA.Message severity="info" icon="pi-eye-slash" title={t('Draft — not visible to clients','مسودة — غير ظاهر للعملاء')} action={<SA.Button size="sm" label={t('Activate','تفعيل')} onClick={()=>{setStatus('active');toast({summary:t('Branch is now active','الفرع نشط الآن')});}}/>}>{t('Add business hours and at least one facility, then activate.','أضف ساعات العمل ومرفقًا واحدًا على الأقل ثم فعّل الفرع.')}</SA.Message>}
    {status==='inactive'&&<SA.Message severity="warn" icon="pi-power-off" title={t('This branch is inactive','هذا الفرع غير نشط')} action={<SA.Button size="sm" variant="outlined" severity="warn" label={t('Reactivate','إعادة التفعيل')} onClick={()=>setStatus('active')}/>}>{t('Clients cannot book here. Existing bookings are unchanged.','لا يمكن للعملاء الحجز هنا. الحجوزات الحالية لم تتغير.')}</SA.Message>}
    <SA.Tabs value={tab} onChange={setTab} tabs={[{label:t('Overview','نظرة عامة'),value:'overview'},{label:t('Business hours','ساعات العمل'),value:'hours'},{label:t('Holidays','العطل'),value:'holidays'},{label:t('Facilities','المرافق'),value:'facilities',count:b.fac},{label:t('Services','الخدمات'),value:'services',count:b.svc},{label:t('Staff','الموظفون'),value:'staff',count:b.staff},{label:t('Tax / VAT','الضريبة'),value:'vat'},{label:t('Activity','النشاط'),value:'activity'}]}/>
    {tab==='overview'&&<div style={{display:'grid',gridTemplateColumns:'minmax(0,2fr) minmax(0,1fr)',gap:16}}>
      <div style={{...panel,padding:20,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>{fact(t("Today's sessions",'حصص اليوم'),b.today)}{fact(t('Staff','الموظفون'),b.staff)}{fact(t('Facilities','المرافق'),b.fac)}{fact(t('Active services','الخدمات النشطة'),b.svc)}</div>
      <div style={{...panel,padding:16,display:'flex',flexDirection:'column',gap:10,font:'var(--text-small)'}}><div style={{font:'var(--text-h4)'}}>{t('Key facts','معلومات أساسية')}</div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-secondary)'}}>{t('Today','اليوم')}</span><span dir="ltr">06:00–12:00, 16:00–22:00</span></div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-secondary)'}}>{t('VAT','الضريبة')}</span><span>15% · {t('excl.','غير شامل')}</span></div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--text-secondary)'}}>{t('Phone','الهاتف')}</span><span dir="ltr">+966 11 456 7890</span></div></div>
    </div>}
    {tab==='hours'&&<HoursTab toast={toast}/>}
    {tab==='holidays'&&<HolidaysTab toast={toast}/>}
    {tab==='facilities'&&<FacilitiesTab go={go} toast={toast}/>}
    {tab==='services'&&<div style={panel}><div style={{padding:'10px 16px',borderBottom:'1px solid var(--border-default)',font:'var(--text-small)',color:'var(--text-secondary)'}}><i className="pi pi-info-circle" style={{marginInlineEnd:6}}></i>{t('Managed in Services.','تُدار من صفحة الخدمات.')}</div>{KIT.sessions.filter((s,i,a)=>a.findIndex(x=>x.svc.en===s.svc.en)===i).slice(0,6).map(s=><a key={s.id} href="#services" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:'1px solid var(--border-subtle)',color:'var(--text-primary)',textDecoration:'none'}}><span style={{width:10,height:10,borderRadius:3,background:s.color}}></span><span style={{flex:1}}>{sessName(s,t)}</span><i className="pi pi-arrow-up-right" style={{fontSize:11,color:'var(--text-muted)'}}></i></a>)}</div>}
    {tab==='staff'&&<div style={panel}><div style={{padding:'10px 16px',borderBottom:'1px solid var(--border-default)',font:'var(--text-small)',color:'var(--text-secondary)'}}><i className="pi pi-info-circle" style={{marginInlineEnd:6}}></i>{t('Managed in Staff.','يُدار من صفحة الموظفين.')}</div>{Object.values(KIT.coaches).map((c,i)=><div key={i} style={{padding:'10px 16px',borderBottom:'1px solid var(--border-subtle)'}}><SA.PersonChip name={t(c.en,c.ar)} secondary={i===0?t('Branch manager','مدير الفرع'):t('Coach','مدرب')}/></div>)}</div>}
    {tab==='vat'&&<VatTab toast={toast}/>}
    {tab==='activity'&&<div style={{...panel,padding:20}}><SA.Timeline events={[{title:t('Branch created','تم إنشاء الفرع'),time:'2 Jan 2026, 10:00',description:t('By Owner','بواسطة المالك'),severity:'info',icon:'pi-plus'},{title:t('Branch activated','تم تفعيل الفرع'),time:'15 Jan 2026, 09:12',severity:'success',icon:'pi-check'},{title:t('Business hours changed','تعديل ساعات العمل'),time:'1 Sep 2026, 13:40',description:t('Friday: 16:00–23:00','الجمعة: 16:00–23:00'),severity:'secondary',icon:'pi-clock'},{title:t('Closure added · National Day','إضافة إغلاق · اليوم الوطني'),time:'10 Sep 2026, 11:05',description:t('4 sessions cancelled','إلغاء 4 حصص'),severity:'warn',icon:'pi-ban'}]}/></div>}
    {edit&&<BranchDrawer branch={b} onClose={()=>setEdit(false)} onSaved={()=>{setEdit(false);toast({summary:t('Branch saved','تم حفظ الفرع')});}}/>}
    {deact&&<DeactivateBranchDialog branch={b} onCancel={()=>setDeact(false)} onConfirm={()=>{setDeact(false);setStatus('inactive');toast({summary:t('Branch deactivated','تم إيقاف الفرع'),severity:'info'});}}/>}
  </div>;
}
Object.assign(window,{BranchDetails});
