const ACT={class:['pi-users','Class','حصة جماعية'],appointment:['pi-user','Appointment','موعد'],event:['pi-star','Event','فعالية'],open:['pi-sign-in','Open access','دخول حر']};
window.CATS=[{id:'mind',color:'var(--svc-2)',icon:'pi-heart',name:{en:'Mind & body',ar:'العقل والجسد'},n:2},{id:'fit',color:'var(--svc-3)',icon:'pi-bolt',name:{en:'Fitness',ar:'اللياقة'},n:3},{id:'aqua',color:'var(--svc-1)',icon:'pi-wave-pulse',name:{en:'Aquatics',ar:'الرياضات المائية'},n:1},{id:'racket',color:'var(--svc-6)',icon:'pi-stop',name:{en:'Racket sports',ar:'رياضات المضرب'},n:1},{id:'kids',color:'var(--svc-5)',icon:'pi-face-smile',name:{en:'Kids',ar:'الأطفال'},n:1}];
window.SERVICES=[
  {id:'yoga',color:'var(--svc-2)',name:{en:'Yoga Flow',ar:'يوغا فلو'},cat:'mind',type:'class',dur:60,cap:15,br:['olaya','dubai'],status:'published',up:24,staff:2,level:'all'},
  {id:'hiit',color:'var(--svc-3)',name:{en:'HIIT 45',ar:'هيت 45'},cat:'fit',type:'class',dur:45,cap:20,br:['olaya','malqa','dubai','fahd'],status:'published',up:18,staff:2,level:'intermediate'},
  {id:'pt',color:'var(--svc-4)',name:{en:'Personal training',ar:'تدريب شخصي'},cat:'fit',type:'appointment',dur:60,cap:1,br:['olaya','dubai'],status:'published',up:31,staff:4,level:'all'},
  {id:'kids',color:'var(--svc-1)',name:{en:'Kids Swim — Level 1',ar:'سباحة أطفال — المستوى 1'},cat:'aqua',type:'class',dur:45,cap:8,br:['olaya'],status:'published',up:12,staff:1,level:'beginner'},
  {id:'padel',color:'var(--svc-6)',name:{en:'Padel Clinic',ar:'تدريب بادل'},cat:'racket',type:'class',dur:90,cap:8,br:['olaya'],status:'draft',up:0,staff:0,level:'all'},
  {id:'camp',color:'var(--svc-5)',name:{en:'',ar:'المخيم الصيفي 2027'},cat:'kids',type:'event',dur:240,cap:30,br:['olaya','malqa'],status:'draft',up:0,staff:2,level:'all'},
  {id:'gym',color:'var(--svc-8)',name:{en:'Gym floor access',ar:'دخول صالة الأجهزة'},cat:'fit',type:'open',dur:null,cap:null,br:['olaya','malqa','dubai'],status:'published',up:0,staff:0,level:'all'},
  {id:'pilates',color:'var(--svc-4)',name:{en:'Pilates Mat',ar:'بيلاتس'},cat:'mind',type:'class',dur:60,cap:12,br:['olaya'],status:'archived',up:0,staff:1,level:'all'}
];
window.PROGRAMS=[{id:'football',color:'var(--svc-7)',name:{en:'Football Academy',ar:'أكاديمية كرة القدم'},cat:'kids',mode:'term',age:'6–14',br:['olaya','malqa'],status:'published',groups:6},{id:'swim',color:'var(--svc-1)',name:{en:'Swimming Academy',ar:'أكاديمية السباحة'},cat:'aqua',mode:'rolling',age:'4–12',br:['olaya'],status:'draft',groups:0}];
window.svcName=(s,t)=>t(s.name.en||s.name.ar,s.name.ar||s.name.en);
window.brName=(id,t)=>{const b=allBranches().find(x=>x.id===id);return b?t(b.name.en,b.name.ar):id;};
function BranchChips({ids,max=2}){const [t]=useT();return <div style={{display:'flex',gap:4,flexWrap:'nowrap'}}>{ids.slice(0,max).map(id=><SA.Tag key={id} size="sm">{brName(id,t)}</SA.Tag>)}{ids.length>max&&<SA.Tag size="sm" severity="info">+{ids.length-max}</SA.Tag>}</div>;}
function ActLabel({type}){const [t]=useT();const a=ACT[type];return <span style={{display:'inline-flex',gap:6,alignItems:'center',whiteSpace:'nowrap',color:'var(--text-secondary)'}}><i className={'pi '+a[0]} style={{fontSize:13}}></i>{t(a[1],a[2])}</span>;}
function SplitNew({onService,onProgram}){
  const [t]=useT();const [o,setO]=React.useState(false);
  return <div style={{position:'relative',display:'flex'}}><SA.Button label={t('New service','خدمة جديدة')} icon="pi-plus" onClick={onService} style={{borderStartEndRadius:0,borderEndEndRadius:0}}/><SA.Button icon="pi-chevron-down" ariaLabel={t('More create options','خيارات إنشاء أخرى')} onClick={()=>setO(!o)} style={{borderStartStartRadius:0,borderEndStartRadius:0,borderInlineStart:'1px solid rgba(255,255,255,.3)'}}/>{o&&<div style={{position:'absolute',top:'calc(100% + 4px)',insetInlineEnd:0,zIndex:30}} onClick={()=>setO(false)}><SA.Menu items={[{label:t('Service','خدمة'),icon:'pi-th-large',onClick:onService},{label:t('Program','برنامج'),icon:'pi-sitemap',onClick:onProgram}]}/></div>}</div>;
}
function ArchiveServiceDialog({svc,onCancel,onConfirm}){
  const [t]=useT();const [opt,setOpt]=React.useState('keep');const [reason,setReason]=React.useState('');const n=svc.up||18;
  return <SA.Dialog header={t('Archive service','أرشفة الخدمة')} onHide={onCancel} width={480} footer={<><SA.Button label={t('Cancel','إلغاء')} variant="text" severity="secondary" onClick={onCancel}/><SA.Button label={t('Archive service','أرشفة الخدمة')} severity="danger" disabled={opt==='cancel'&&reason.trim().length<3} onClick={()=>onConfirm(opt)}/></>}>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <SA.Message severity="warn" title={t('This service has '+n+' upcoming sessions.','لدى هذه الخدمة '+n+' حصة قادمة.')}>{t('No new sessions can be created after archiving.','لا يمكن إنشاء حصص جديدة بعد الأرشفة.')}</SA.Message>
      <SA.RadioButton name="arch" value="keep" checked={opt==='keep'} onChange={setOpt} label={t('Keep them until they finish','إبقاؤها حتى تنتهي')} description={t('Booked clients still attend.','يحضر العملاء المحجوزون كالمعتاد.')}/>
      <SA.RadioButton name="arch" value="cancel" checked={opt==='cancel'} onChange={setOpt} label={t('Cancel them now','إلغاؤها الآن')} description={t('Bookings are cancelled and clients notified.','تُلغى الحجوزات ويتم إشعار العملاء.')}/>
      {opt==='cancel'&&<SA.Field label={t('Reason','السبب')} required><SA.Textarea rows={2} value={reason} onChange={setReason}/></SA.Field>}
    </div>
  </SA.Dialog>;
}
function ProgramDrawer({onClose,onSaved}){
  const [t]=useT();const [mode,setMode]=React.useState('term');const [br,setBr]=React.useState(['olaya']);
  return <SA.EntityDrawer title={t('New program','برنامج جديد')} onCancel={onClose} onSave={onSaved} cancelLabel={t('Cancel','إلغاء')} saveLabel={t('Save program','حفظ البرنامج')}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Name (Arabic)','الاسم (عربي)')} required><SA.InputText dir="rtl"/></SA.Field><SA.Field label={t('Name (English)','الاسم (إنجليزي)')} required><SA.InputText dir="ltr"/></SA.Field></div>
    <SA.Field label={t('Sport / category','الرياضة / الفئة')}><SA.Select value="kids" options={CATS.map(c=>({label:t(c.name.en,c.name.ar),value:c.id,icon:c.icon}))}/></SA.Field>
    <SA.Field label={t('Description','الوصف')}><SA.Textarea rows={2}/></SA.Field>
    <SA.Field label={t('Branches','الفروع')}><SA.MultiSelect value={br} onChange={setBr} options={allBranches().filter(b=>b.status!=='archived').map(b=>({label:t(b.name.en,b.name.ar),value:b.id}))}/></SA.Field>
    <SA.Field label={t('Enrollment','التسجيل')}><SA.SelectButton value={mode} onChange={setMode} options={[{label:t('Term with dates','فصل بتواريخ'),value:'term'},{label:t('Rolling monthly','شهري مستمر'),value:'rolling'}]}/></SA.Field>
    {mode==='term'&&<SA.DatePicker mode="range" value={['2026-09-01','2027-01-15']}/>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Age range','الفئة العمرية')}><div style={{display:'flex',gap:6,alignItems:'center'}}><SA.InputNumber value={6}/><span>–</span><SA.InputNumber value={14}/></div></SA.Field><SA.Field label={t('Gender','الجنس')}><SA.SelectButton value="any" options={[{label:t('Any','الكل'),value:'any'},{label:t('Male','ذكور'),value:'m'},{label:t('Female','إناث'),value:'f'}]}/></SA.Field></div>
    <SA.Field label={t('Status','الحالة')}><SA.SelectButton value="draft" options={[{label:t('Draft','مسودة'),value:'draft'},{label:t('Published','منشور'),value:'published'}]}/></SA.Field>
  </SA.EntityDrawer>;
}
function ServicesScreen({go,toast,state,tab:tab0}){
  const [t,lang]=useT();
  const [tab,setTab]=React.useState(tab0||'services');const [q,setQ]=React.useState('');const [cat,setCat]=React.useState('all');const [type,setType]=React.useState('all');const [st,setSt]=React.useState('active');const [sel,setSel]=React.useState([]);const [prog,setProg]=React.useState(false);const [arch,setArch]=React.useState(null);
  const empty=state==='empty';
  const rows=SERVICES.filter(s=>(st==='active'?s.status!=='archived':s.status===st)&&(cat==='all'||s.cat===cat)&&(type==='all'||s.type===type)&&(!q||(s.name.en+s.name.ar).toLowerCase().includes(q.toLowerCase())));
  const catOf=id=>CATS.find(c=>c.id===id);
  const cols=[
    {field:'name',header:t('Service','الخدمة'),body:s=><div style={{display:'flex',alignItems:'center',gap:10}}><span style={{width:10,height:10,borderRadius:3,background:s.color,flex:'none'}}></span><span style={{font:'500 14px/1.4 var(--font-sans)'}}>{svcName(s,t)}</span>{(!s.name.en||!s.name.ar)&&<i className="pi pi-language" title={t('Name missing in one language','الاسم ناقص في إحدى اللغتين')} style={{fontSize:12,color:'var(--sev-warn-fg)'}}></i>}</div>},
    {field:'cat',header:t('Category','الفئة'),body:s=><span style={{whiteSpace:'nowrap'}}>{t(catOf(s.cat).name.en,catOf(s.cat).name.ar)}</span>},
    {field:'type',header:t('Type','النوع'),body:s=><ActLabel type={s.type}/>},
    {field:'dur',header:t('Duration','المدة'),align:'end',body:s=>s.dur?<span className="num" style={{whiteSpace:'nowrap'}}>{s.dur} {t('min','د')}</span>:<span style={{color:'var(--text-muted)'}}>—</span>},
    {field:'cap',header:t('Capacity','السعة'),align:'end',body:s=>s.cap?<span className="num">{s.cap}</span>:<span style={{color:'var(--text-muted)'}}>—</span>},
    {field:'br',header:t('Branches','الفروع'),body:s=><BranchChips ids={s.br}/>},
    {field:'status',header:t('Status','الحالة'),body:s=><SA.StatusTag status={s.status} lang={lang}/>},
    {field:'up',header:t('Upcoming','القادمة'),align:'end',body:s=><span className="num">{s.up}</span>}
  ];
  const pcols=[
    {field:'name',header:t('Program','البرنامج'),body:p=><div style={{display:'flex',alignItems:'center',gap:10}}><span style={{width:10,height:10,borderRadius:3,background:p.color}}></span><span style={{font:'500 14px var(--font-sans)'}}>{t(p.name.en,p.name.ar)}</span></div>},
    {field:'mode',header:t('Enrollment','التسجيل'),body:p=>p.mode==='term'?t('Term','فصلي'):t('Rolling monthly','شهري مستمر')},
    {field:'age',header:t('Ages','الأعمار'),body:p=><span dir="ltr" className="num">{p.age}</span>},
    {field:'br',header:t('Branches','الفروع'),body:p=><BranchChips ids={p.br}/>},
    {field:'status',header:t('Status','الحالة'),body:p=><SA.StatusTag status={p.status} lang={lang}/>}
  ];
  const tpl=[['pi-users','Yoga class','حصة يوغا','Class · 60 min · 15 people','حصة جماعية · 60 د · 15 شخص'],['pi-user','Personal training','تدريب شخصي','Appointment · 60 min · 1:1','موعد · 60 د · فردي'],['pi-flag','Football training','تدريب كرة قدم','Class · 90 min · 20 people','حصة جماعية · 90 د · 20 شخص']];
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <SA.PageHeader title={t('Services','الخدمات')} meta={!empty&&<span>{t('7 services · 2 programs','7 خدمات · برنامجان')}</span>} actions={<SA.Button label={t('Categories','الفئات')} icon="pi-tags" severity="secondary" variant="outlined" onClick={()=>go('categories')}/>} primaryAction={<SplitNew onService={()=>go('service-new')} onProgram={()=>setProg(true)}/>}/>
    {empty?<div style={{background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',padding:'32px 24px'}}>
      <SA.EmptyState icon="pi-th-large" title={t('Set up what you offer','حدّد ما تقدمه')} description={t('Start from a template or create a service from scratch.','ابدأ من قالب أو أنشئ خدمة من الصفر.')}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,maxWidth:720,margin:'0 auto'}}>{tpl.map((x,i)=><button key={i} type="button" onClick={()=>go('service-new')} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:8,padding:16,border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',background:'var(--surface-card)',cursor:'pointer',textAlign:'start',color:'var(--text-primary)'}}><i className={'pi '+x[0]} style={{fontSize:18,color:'var(--primary)'}}></i><span style={{font:'var(--text-h4)'}}>{t(x[1],x[2])}</span><span style={{font:'var(--text-small)',color:'var(--text-secondary)'}}>{t(x[3],x[4])}</span></button>)}</div>
      <div style={{display:'flex',justifyContent:'center',marginTop:16}}><SA.Button label={t('Start from scratch','ابدأ من الصفر')} variant="text" icon="pi-plus" onClick={()=>go('service-new')}/></div>
    </div>:<>
    <SA.Tabs value={tab} onChange={setTab} tabs={[{label:t('Services','الخدمات'),value:'services',count:7},{label:t('Programs','البرامج'),value:'programs',count:2}]}/>
    {tab==='services'?<>
      <SA.FilterBar search={q} onSearch={setQ} searchPlaceholder={t('Search Arabic or English name','ابحث بالاسم العربي أو الإنجليزي')}
        filters={<><SA.Select value={cat} onChange={setCat} style={{width:160}} options={[{label:t('All categories','كل الفئات'),value:'all'},...CATS.map(c=>({label:t(c.name.en,c.name.ar),value:c.id}))]}/><SA.Select value={type} onChange={setType} style={{width:160}} options={[{label:t('All types','كل الأنواع'),value:'all'},...Object.entries(ACT).map(([k,a])=>({label:t(a[1],a[2]),value:k,icon:a[0]}))]}/><SA.Select value={st} onChange={setSt} style={{width:150}} options={[{label:t('Not archived','غير مؤرشفة'),value:'active'},{label:t('Published','منشورة'),value:'published'},{label:t('Draft','مسودة'),value:'draft'},{label:t('Archived','مؤرشفة'),value:'archived'}]}/></>}
        onMoreFilters={()=>{}} moreLabel={t('Branch, coach','الفرع، المدرب')}/>
      <SA.BulkActionBar count={sel.length} label={sel.length+' '+t('selected','محدد')} clearLabel={t('Clear','مسح')} onClear={()=>setSel([])} actions={<><SA.Button size="sm" severity="contrast" label={t('Publish','نشر')} icon="pi-send" onClick={()=>{setSel([]);toast({summary:t('Services published','تم نشر الخدمات')});}}/><SA.Button size="sm" severity="contrast" label={t('Add to branch','إضافة لفرع')} icon="pi-building"/><SA.Button size="sm" severity="contrast" label={t('Archive','أرشفة')} icon="pi-inbox" onClick={()=>setArch(SERVICES[0])}/></>}/>
      <SA.DataTable columns={cols} rows={rows} selectable selection={sel} onSelectionChange={setSel} onRowClick={s=>go('service',{id:s.id})} emptyState={<SA.EmptyState compact icon="pi-search" title={t('No services match','لا توجد خدمات مطابقة')}/>}/>
    </>:<>
      <div style={{display:'flex',justifyContent:'flex-end'}}><SA.Button label={t('New program','برنامج جديد')} icon="pi-plus" severity="secondary" onClick={()=>setProg(true)}/></div>
      <SA.DataTable columns={pcols} rows={PROGRAMS} onRowClick={p=>go('program',{id:p.id})}/>
    </>}
    </>}
    {prog&&<ProgramDrawer onClose={()=>setProg(false)} onSaved={()=>{setProg(false);toast({summary:t('Program saved as draft','تم حفظ البرنامج كمسودة')});}}/>}
    {arch&&<ArchiveServiceDialog svc={arch} onCancel={()=>setArch(null)} onConfirm={()=>{setArch(null);setSel([]);toast({summary:t('Service archived','تمت أرشفة الخدمة'),severity:'info'});}}/>}
  </div>;
}
function ProgramDetails({id,go}){
  const [t,lang]=useT();const p=PROGRAMS.find(x=>x.id===id)||PROGRAMS[0];
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <SA.PageHeader breadcrumb={[{label:t('Services','الخدمات'),onClick:e=>{e.preventDefault();go('services',{tab:'programs'});}},{label:t(p.name.en,p.name.ar)}]} title={t(p.name.en,p.name.ar)} status={<SA.StatusTag status={p.status} lang={lang}/>} meta={<><span>{p.mode==='term'?t('Term · 1 Sep – 15 Jan','فصلي · 1 سبتمبر – 15 يناير'):t('Rolling monthly','شهري مستمر')}</span><span dir="ltr">{t('Ages ','الأعمار ')}{p.age}</span></>} primaryAction={<SA.Button label={t('Edit','تعديل')} icon="pi-pencil"/>}/>
    <SA.Message severity="info" icon="pi-sitemap" title={t('Levels, age groups and groups','المستويات والفئات العمرية والمجموعات')}>{t('These are managed in the Academy module, coming in a later release.','تُدار من وحدة الأكاديمية، المتاحة في إصدار لاحق.')}</SA.Message>
    <div style={{background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',padding:20,display:'grid',gridTemplateColumns:'160px 1fr',gap:'12px 24px'}}><span style={{color:'var(--text-secondary)'}}>{t('Branches','الفروع')}</span><BranchChips ids={p.br} max={4}/><span style={{color:'var(--text-secondary)'}}>{t('Gender','الجنس')}</span><span>{t('Any','الكل')}</span><span style={{color:'var(--text-secondary)'}}>{t('Category','الفئة')}</span><span>{t(CATS.find(c=>c.id===p.cat).name.en,CATS.find(c=>c.id===p.cat).name.ar)}</span></div>
  </div>;
}
function CategoriesScreen({go,toast}){
  const [t]=useT();const [list,setList]=React.useState(CATS);const [drag,setDrag]=React.useState(null);
  const move=(from,to)=>{if(from===to)return;const a=[...list];const [x]=a.splice(from,1);a.splice(to,0,x);setList(a);};
  return <div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:820}}>
    <SA.PageHeader breadcrumb={[{label:t('Settings','الإعدادات'),onClick:e=>{e.preventDefault();go('settings');}},{label:t('Service categories','فئات الخدمات')}]} title={t('Service categories','فئات الخدمات')} meta={<span>{t('Drag to change the order clients see.','اسحب لتغيير الترتيب الذي يراه العملاء.')}</span>} primaryAction={<SA.Button label={t('New category','فئة جديدة')} icon="pi-plus"/>}/>
    <div style={{background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)'}}>{list.map((c,i)=><div key={c.id} draggable onDragStart={()=>setDrag(i)} onDragOver={e=>{e.preventDefault();if(drag!==null&&drag!==i){move(drag,i);setDrag(i);}}} onDragEnd={()=>{setDrag(null);toast({summary:t('Order saved','تم حفظ الترتيب'),severity:'info'});}} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',borderBottom:'1px solid var(--border-subtle)',background:drag===i?'var(--surface-selected)':'transparent'}}>
      <i className="pi pi-bars" style={{color:'var(--text-muted)',cursor:'grab'}}></i>
      <span style={{width:32,height:32,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'color-mix(in srgb,'+c.color+' 14%,transparent)',color:c.color}}><i className={'pi '+c.icon}></i></span>
      <div style={{flex:1,minWidth:0,display:'flex',gap:16,flexWrap:'wrap'}}><span dir="rtl" style={{font:'500 14px var(--font-arabic)'}}>{c.name.ar}</span><span dir="ltr" style={{font:'var(--text-body)',color:'var(--text-secondary)'}}>{c.name.en}</span></div>
      <span style={{font:'var(--text-small)',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{c.n} {t('services','خدمات')}</span>
      <SA.Button size="sm" variant="text" severity="secondary" icon="pi-pencil" ariaLabel={t('Edit','تعديل')}/>
      <SA.Button size="sm" variant="text" severity="secondary" icon="pi-inbox" ariaLabel={t('Archive','أرشفة')} onClick={()=>{setList(list.filter(x=>x.id!==c.id));toast({summary:t('Category archived','تمت أرشفة الفئة'),severity:'info'});}}/>
    </div>)}</div>
  </div>;
}
Object.assign(window,{ServicesScreen,ProgramDetails,CategoriesScreen,ArchiveServiceDialog,BranchChips,ActLabel,ACT});
