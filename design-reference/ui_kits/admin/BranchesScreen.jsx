window.BRANCH_INFO={
  olaya:{status:'active',tzName:'Asia/Riyadh',fac:4,svc:12,staff:18,today:8,addr:{en:'Olaya St, Riyadh',ar:'شارع العليا، الرياض'}},
  malqa:{status:'draft',tzName:'Asia/Riyadh',fac:2,svc:0,staff:3,today:0,addr:{en:'Anas Ibn Malik Rd, Riyadh',ar:'طريق أنس بن مالك، الرياض'}},
  dubai:{status:'active',tzName:'Asia/Dubai',fac:3,svc:7,staff:9,today:5,addr:{en:'Marina Walk, Dubai',ar:'ممشى المارينا، دبي'}},
  fahd:{status:'inactive',tzName:'Asia/Riyadh',fac:2,svc:4,staff:0,today:0,addr:{en:'King Fahd Rd, Riyadh',ar:'طريق الملك فهد، الرياض'},name:{en:'King Fahd branch',ar:'فرع الملك فهد'},tz:'AST'},
  khobar:{status:'archived',tzName:'Asia/Riyadh',fac:0,svc:0,staff:0,today:0,addr:{en:'Corniche, Al Khobar',ar:'الكورنيش، الخبر'},name:{en:'Al Khobar (old)',ar:'الخبر (قديم)'},tz:'AST'}
};
window.allBranches=function(){return Object.entries(BRANCH_INFO).map(([id,i])=>{const b=KIT.branches.find(x=>x.id===id);return {id,...i,name:b?b.name:i.name,tz:b?b.tz:i.tz};});};
function BranchDrawer({branch,onClose,onSaved}){
  const [t]=useT();const b=branch||{};
  const [st,setSt]=React.useState(b.status||'draft');const [tz,setTz]=React.useState(b.tzName||'Asia/Riyadh');
  return <SA.EntityDrawer title={branch?t('Edit branch','تعديل الفرع'):t('New branch','فرع جديد')} subtitle={branch?t(b.name.en,b.name.ar):null} onCancel={onClose} onSave={onSaved} cancelLabel={t('Cancel','إلغاء')} saveLabel={t('Save branch','حفظ الفرع')}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Name (Arabic)','الاسم (عربي)')} required><SA.InputText dir="rtl" value={b.name?b.name.ar:''}/></SA.Field><SA.Field label={t('Name (English)','الاسم (إنجليزي)')} required><SA.InputText dir="ltr" value={b.name?b.name.en:''}/></SA.Field></div>
    <SA.Field label={t('Address','العنوان')}><SA.InputText icon="pi-map-marker" value={b.addr?t(b.addr.en,b.addr.ar):''}/></SA.Field>
    <SA.Field label={t('Map pin','الموقع على الخريطة')} help={t('Optional','اختياري')}><div style={{height:120,borderRadius:8,border:'1px dashed var(--border-strong)',background:'var(--surface-sunken)',display:'flex',alignItems:'center',justifyContent:'center',gap:8,color:'var(--text-muted)',font:'var(--text-small)'}}><i className="pi pi-map"></i>{t('Click to drop a pin','اضغط لتحديد الموقع')}</div></SA.Field>
    <SA.Field label={t('Timezone','المنطقة الزمنية')} required help={t('Session times at this branch use this timezone.','تُعرض أوقات الحصص في هذا الفرع بهذه المنطقة.')}><SA.Select value={tz} onChange={setTz} icon="pi-clock" options={[{label:'Asia/Riyadh',value:'Asia/Riyadh',meta:'AST · UTC+3',sub:t('Organization default','الافتراضي للمنظمة')},{label:'Asia/Dubai',value:'Asia/Dubai',meta:'GST · UTC+4'},{label:'Asia/Kuwait',value:'Asia/Kuwait',meta:'AST · UTC+3'},{label:'Asia/Bahrain',value:'Asia/Bahrain',meta:'AST · UTC+3'},{label:'Africa/Cairo',value:'Africa/Cairo',meta:'EET · UTC+2'}]}/></SA.Field>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Phone','الهاتف')}><SA.InputText dir="ltr" prefix="+966" value="11 456 7890"/></SA.Field><SA.Field label={t('Email','البريد الإلكتروني')}><SA.InputText dir="ltr" value=""/></SA.Field></div>
    <SA.Field label={t('Photo','الصورة')}><SA.FileUpload variant="logo" label={t('Upload photo','رفع صورة')}/></SA.Field>
    <SA.Field label={t('Status','الحالة')} help={st==='draft'?t('Draft branches are hidden from clients.','الفروع المسودة مخفية عن العملاء.'):null}><SA.SelectButton value={st} onChange={setSt} options={[{label:t('Draft','مسودة'),value:'draft'},{label:t('Active','نشط'),value:'active'}]}/></SA.Field>
  </SA.EntityDrawer>;
}
function DeactivateBranchDialog({branch,onCancel,onConfirm}){
  const [t]=useT();const name=t(branch.name.en,branch.name.ar);
  const [opt,setOpt]=React.useState('keep');const [reason,setReason]=React.useState('');const [typed,setTyped]=React.useState('');
  const ok=typed.trim()===name&&(opt==='keep'||reason.trim().length>2);
  return <SA.Dialog header={t('Deactivate branch','إيقاف الفرع')} onHide={onCancel} width={500} footer={<><SA.Button label={t('Cancel','إلغاء')} variant="text" severity="secondary" onClick={onCancel}/><SA.Button label={t('Deactivate branch','إيقاف الفرع')} severity="danger" disabled={!ok} onClick={()=>onConfirm(opt)}/></>}>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <SA.Message severity="warn" title={t('This branch has 34 upcoming sessions and 210 bookings.','لدى هذا الفرع 34 حصة قادمة و210 حجوزات.')}>{t('Clients will no longer be able to book here.','لن يتمكن العملاء من الحجز في هذا الفرع.')}</SA.Message>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <SA.RadioButton name="deact" value="keep" checked={opt==='keep'} onChange={setOpt} label={t('Keep upcoming sessions','إبقاء الحصص القادمة')} description={t('Existing bookings still happen. No new bookings.','تستمر الحجوزات الحالية دون حجوزات جديدة.')}/>
        <SA.RadioButton name="deact" value="cancel" checked={opt==='cancel'} onChange={setOpt} label={t('Cancel all future sessions','إلغاء كل الحصص القادمة')} description={t('210 bookings are cancelled and clients are notified.','تُلغى 210 حجوزات ويتم إشعار العملاء.')}/>
      </div>
      {opt==='cancel'&&<SA.Field label={t('Reason (sent to clients)','السبب (يُرسل للعملاء)')} required><SA.Textarea rows={2} value={reason} onChange={setReason}/></SA.Field>}
      <SA.Field label={<span>{t('Type ','اكتب ')}<b>{name}</b>{t(' to confirm',' للتأكيد')}</span>}><SA.InputText value={typed} onChange={setTyped} placeholder={name}/></SA.Field>
    </div>
  </SA.Dialog>;
}
function BranchesScreen({go,toast,state}){
  const [t,lang]=useT();
  const [filter,setFilter]=React.useState('all');const [q,setQ]=React.useState('');const [drawer,setDrawer]=React.useState(false);const [restored,setRestored]=React.useState([]);
  const empty=state==='empty';
  const rows=empty?[]:allBranches().map(b=>restored.includes(b.id)?{...b,status:'inactive'}:b).filter(b=>(filter==='archived'?b.status==='archived':b.status!=='archived'&&(filter==='all'||b.status===filter))&&(!q||(b.name.en+b.name.ar).toLowerCase().includes(q.toLowerCase())));
  const archived=filter==='archived';
  const cols=[
    {field:'name',header:t('Branch','الفرع'),body:b=><div style={{display:'flex',alignItems:'center',gap:12}}><span style={{width:36,height:36,flex:'none',borderRadius:8,background:'var(--surface-sunken)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)'}}><i className="pi pi-building"></i></span><div style={{minWidth:0}}><div style={{font:'500 14px/1.4 var(--font-sans)'}}>{t(b.name.en,b.name.ar)}</div><div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{t(b.addr.en,b.addr.ar)}</div></div></div>},
    {field:'status',header:t('Status','الحالة'),body:b=><SA.StatusTag status={b.status} lang={lang}/>},
    {field:'tz',header:t('Timezone','المنطقة الزمنية'),body:b=><span dir="ltr" style={{display:'inline-flex',gap:6,alignItems:'center',whiteSpace:'nowrap'}}><span style={{font:'600 10px/18px var(--font-sans)',padding:'0 5px',borderRadius:4,background:'var(--surface-sunken)',color:'var(--text-secondary)'}}>{b.tz}</span><span style={{font:'var(--text-small)',color:'var(--text-secondary)'}}>{b.tzName}</span></span>},
    {field:'fac',header:t('Facilities','المرافق'),align:'end',body:b=><span className="num">{b.fac}</span>},
    {field:'svc',header:t('Active services','الخدمات النشطة'),align:'end',body:b=><span className="num">{b.svc}</span>},
    {field:'staff',header:t('Staff','الموظفون'),align:'end',body:b=><span className="num">{b.staff}</span>},
    {field:'today',header:t("Today's sessions",'حصص اليوم'),align:'end',body:b=><span className="num">{b.today}</span>}
  ];
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <SA.PageHeader title={t('Branches','الفروع')} meta={!empty&&<span>{t('4 branches · 1 archived','4 فروع · 1 مؤرشف')}</span>} primaryAction={<SA.Button label={t('New branch','فرع جديد')} icon="pi-plus" onClick={()=>setDrawer(true)}/>}/>
    {empty?<div style={{background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',padding:'40px 0'}}><SA.EmptyState icon="pi-building" title={t('Create your first branch','أنشئ فرعك الأول')} description={t('Branches hold your business hours, facilities and VAT. You need one before you can schedule sessions.','الفروع تحدد ساعات العمل والمرافق والضريبة. تحتاج فرعًا واحدًا على الأقل قبل جدولة الحصص.')} action={<SA.Button label={t('Create branch','إنشاء فرع')} icon="pi-plus" onClick={()=>setDrawer(true)}/>}/></div>:<>
    <SA.FilterBar search={q} onSearch={setQ} searchPlaceholder={t('Search branches','ابحث عن فرع')} filters={<SA.SelectButton value={filter} onChange={setFilter} options={[{label:t('All','الكل'),value:'all'},{label:t('Active','نشط'),value:'active'},{label:t('Draft','مسودة'),value:'draft'},{label:t('Inactive','غير نشط'),value:'inactive'},{label:t('Archived','مؤرشف'),value:'archived',icon:'pi-inbox'}]}/>}/>
    {archived&&<SA.Message severity="secondary" icon="pi-inbox">{t('Archived branches are hidden everywhere. Restore one to make it Inactive again.','الفروع المؤرشفة مخفية في كل مكان. استعد الفرع ليعود بحالة "غير نشط".')}</SA.Message>}
    <SA.DataTable columns={cols} rows={rows} onRowClick={archived?undefined:b=>go('branch',{id:b.id})} rowActions={archived?b=><SA.Button size="sm" variant="outlined" label={t('Restore','استعادة')} icon="pi-replay pi-dir" onClick={()=>{setRestored([...restored,b.id]);toast({summary:t('Branch restored as Inactive','تمت استعادة الفرع كغير نشط')});}}/>:()=> <i className="pi pi-chevron-right pi-dir" style={{color:'var(--text-muted)',fontSize:12}}></i>}
      emptyState={<SA.EmptyState compact icon={archived?'pi-inbox':'pi-search'} title={archived?t('No archived branches','لا توجد فروع مؤرشفة'):t('No branches match','لا توجد فروع مطابقة')}/>}/>
    </>}
    {drawer&&<BranchDrawer onClose={()=>setDrawer(false)} onSaved={()=>{setDrawer(false);toast({summary:t('Branch created as draft','تم إنشاء الفرع كمسودة'),detail:t('Add business hours and facilities, then activate it.','أضف ساعات العمل والمرافق ثم فعّله.')});}}/>}
  </div>;
}
Object.assign(window,{BranchesScreen,BranchDrawer,DeactivateBranchDialog});
