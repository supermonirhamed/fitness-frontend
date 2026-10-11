function TypeCard({k,on,onPick}){
  const [t]=useT();const a=ACT[k];
  const info={class:['Group, scheduled at set times.','Example: Yoga Flow, Mon & Wed 18:00','جماعية، في أوقات محددة.','مثال: يوغا فلو، الاثنين والأربعاء 18:00'],appointment:['1:1, booked from staff availability.','Example: Personal training, 60 min','فردية، تُحجز حسب توفر المدرب.','مثال: تدريب شخصي، 60 دقيقة'],event:['One-off or multi-day.','Example: Summer camp, 5 days','لمرة واحدة أو عدة أيام.','مثال: مخيم صيفي، 5 أيام'],open:['Entry without a session.','Example: Gym floor access','دخول بدون حصة.','مثال: دخول صالة الأجهزة']}[k];
  return <button type="button" onClick={()=>onPick(k)} aria-pressed={on} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:8,padding:20,borderRadius:'var(--radius-card)',border:on?'2px solid var(--primary)':'1px solid var(--border-default)',margin:on?0:1,background:on?'var(--primary-subtle)':'var(--surface-card)',cursor:'pointer',textAlign:'start',color:'var(--text-primary)'}}>
    <span style={{width:40,height:40,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:on?'var(--primary)':'var(--surface-sunken)',color:on?'var(--text-on-primary)':'var(--text-secondary)'}}><i className={'pi '+a[0]} style={{fontSize:18}}></i></span>
    <span style={{font:'var(--text-h3)'}}>{t(a[1],a[2])}</span>
    <span style={{font:'var(--text-body)',color:'var(--text-secondary)'}}>{t(info[0],info[2])}</span>
    <span style={{font:'var(--text-small)',color:'var(--text-muted)'}}>{t(info[1],info[3])}</span>
  </button>;
}
function RulesBlock(){
  const [t]=useT();const [open,setOpen]=React.useState(false);
  return <div style={{border:'1px solid var(--border-default)',borderRadius:8}}><button type="button" onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'12px 14px',border:0,background:'transparent',cursor:'pointer',color:'var(--text-primary)',textAlign:'start'}}><i className={'pi '+(open?'pi-chevron-down':'pi-chevron-right pi-dir')} style={{fontSize:12,color:'var(--text-muted)'}}></i><span style={{flex:1,font:'var(--text-h4)'}}>{t('Booking rules','قواعد الحجز')}</span><SA.Tag size="sm">{t('Uses organization defaults','تستخدم إعدادات المنظمة')}</SA.Tag></button>{open&&<div style={{padding:'0 14px 14px'}}><BookingRulesTable compact/></div>}</div>;
}
function ServiceWizard({go,toast}){
  const [t,lang]=useT();
  const [step,setStep]=React.useState(0);const [type,setType]=React.useState('class');
  const [nameAr,setNameAr]=React.useState('يوغا للمبتدئين');const [nameEn,setNameEn]=React.useState('');
  const [br,setBr]=React.useState(['olaya','dubai']);const [pay,setPay]=React.useState({membership:true,package:false,dropin:true,free:false});
  const [cap,setCap]=React.useState(15);const [ov,setOv]=React.useState({olaya:15,dubai:12});
  const steps=[t('Type','النوع'),t('Basics','الأساسيات'),t('Defaults','الافتراضيات'),t('Where & who','المكان والمدربون'),t('Booking & payment','الحجز والدفع'),t('Review','المراجعة')].map(l=>({label:l}));
  const payOk=Object.values(pay).some(Boolean);const nameMissing=!nameAr||!nameEn;
  const maxFac={olaya:20,dubai:12,malqa:10};
  const card={background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',padding:24,display:'flex',flexDirection:'column',gap:16};
  const next=()=>setStep(Math.min(step+1,5));
  return <div style={{display:'flex',flexDirection:'column',gap:20,maxWidth:920,margin:'0 auto'}}>
    <SA.PageHeader breadcrumb={[{label:t('Services','الخدمات'),onClick:e=>{e.preventDefault();go('services');}},{label:t('New service','خدمة جديدة')}]} title={t('New service','خدمة جديدة')}/>
    <div style={{...card,padding:'16px 20px',overflowX:'auto'}}><SA.Stepper steps={steps} active={step} onStepClick={i=>i<step&&setStep(i)}/></div>
    {step===0&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>{Object.keys(ACT).map(k=><TypeCard key={k} k={k} on={type===k} onPick={setType}/>)}</div>}
    {step===1&&<div style={card}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Name (Arabic)','الاسم (عربي)')} required><SA.InputText dir="rtl" value={nameAr} onChange={setNameAr}/></SA.Field><SA.Field label={t('Name (English)','الاسم (إنجليزي)')} required><SA.InputText dir="ltr" value={nameEn} onChange={setNameEn} invalid={!nameEn} placeholder="Yoga for beginners"/></SA.Field></div>
      {nameMissing&&<SA.Message severity="warn" icon="pi-language">{t('Add the name in both languages so clients see it in their app language.','أضف الاسم باللغتين ليظهر للعملاء بلغة تطبيقهم.')}</SA.Message>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Category','الفئة')}><SA.Select value="mind" options={CATS.map(c=>({label:t(c.name.en,c.name.ar),value:c.id,icon:c.icon}))}/></SA.Field><SA.Field label={t('Colour','اللون')}><div style={{display:'flex',gap:6,height:36,alignItems:'center'}}>{[1,2,3,4,5,6,7,8].map(i=><span key={i} style={{width:24,height:24,borderRadius:6,background:'var(--svc-'+i+')',boxShadow:i===2?'0 0 0 2px var(--surface-card),0 0 0 4px var(--svc-2)':'none',cursor:'pointer'}}></span>)}</div></SA.Field></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Description (Arabic)','الوصف (عربي)')}><SA.Textarea rows={3} value="حصة هادئة لتعلم الوضعيات الأساسية والتنفس."/></SA.Field><SA.Field label={t('Description (English)','الوصف (إنجليزي)')}><SA.Textarea rows={3}/></SA.Field></div>
      <SA.Field label={t('Images','الصور')}><SA.FileUpload variant="logo" label={t('Upload image','رفع صورة')}/></SA.Field>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12}}>
        <SA.Field label={t('Level','المستوى')}><SA.Select value="beginner" options={[{label:t('Beginner','مبتدئ'),value:'beginner'},{label:t('Intermediate','متوسط'),value:'intermediate'},{label:t('Advanced','متقدم'),value:'advanced'},{label:t('All levels','كل المستويات'),value:'all'}]}/></SA.Field>
        <SA.Field label={t('Age range','الفئة العمرية')}><div style={{display:'flex',gap:6,alignItems:'center'}}><SA.InputNumber value={16}/><span>–</span><SA.InputNumber placeholder={t('Any','أي')}/></div></SA.Field>
        <SA.Field label={t('Gender','الجنس')}><SA.SelectButton fullWidth value="any" options={[{label:t('Any','الكل'),value:'any'},{label:t('Male','ذكور'),value:'m'},{label:t('Female','إناث'),value:'f'}]}/></SA.Field>
      </div>
    </div>}
    {step===2&&<div style={card}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {type!=='open'&&<SA.Field label={t('Duration','المدة')}><SA.InputNumber mode="minutes" unitLabel={t('min','دقيقة')} value={60} step={15} showButtons/></SA.Field>}
        {type!=='open'&&<SA.Field label={t('Default capacity','السعة الافتراضية')}><SA.InputNumber value={cap} onChange={setCap} unitLabel={t('people','شخص')} showButtons/></SA.Field>}
        {type!=='open'&&<SA.Field label={t('Buffer before','فاصل قبل')} help={t('Blocks the coach and room, not shown to clients.','يحجز المدرب والمرفق، ولا يظهر للعملاء.')}><SA.InputNumber mode="minutes" unitLabel={t('min','دقيقة')} value={0} step={5} showButtons/></SA.Field>}
        {type!=='open'&&<SA.Field label={t('Buffer after','فاصل بعد')} help={t('Blocks the coach and room, not shown to clients.','يحجز المدرب والمرفق، ولا يظهر للعملاء.')}><SA.InputNumber mode="minutes" unitLabel={t('min','دقيقة')} value={10} step={5} showButtons/></SA.Field>}
        {type==='appointment'&&<SA.Field label={t('Slot interval','فاصل المواعيد')} help={t('How often a new start time is offered.','كل كم دقيقة يُعرض وقت بدء جديد.')}><SA.InputNumber mode="minutes" unitLabel={t('min','دقيقة')} value={30} step={15} showButtons/></SA.Field>}
      </div>
      {type==='open'&&<SA.Message severity="info">{t('Open access has no duration or capacity — clients check in during business hours.','الدخول الحر بدون مدة أو سعة — يسجّل العملاء حضورهم خلال ساعات العمل.')}</SA.Message>}
    </div>}
    {step===3&&<div style={card}>
      <SA.Field label={t('Branches','الفروع')} required><SA.MultiSelect value={br} onChange={setBr} options={allBranches().filter(b=>b.status!=='archived').map(b=>({label:t(b.name.en,b.name.ar),value:b.id}))}/></SA.Field>
      {type!=='open'&&br.length>0&&<div style={{border:'1px solid var(--border-default)',borderRadius:8}}><div style={{padding:'10px 14px',font:'var(--text-h4)',borderBottom:'1px solid var(--border-default)'}}>{t('Capacity per branch','السعة لكل فرع')}</div>{br.map(id=>{const max=maxFac[id]||10;const v=ov[id]??cap;return <div key={id} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 160px',gap:12,alignItems:'center',padding:'10px 14px',borderBottom:'1px solid var(--border-subtle)'}}><div><div style={{font:'500 14px var(--font-sans)'}}>{brName(id,t)}</div><div style={{font:'var(--text-caption)',fontWeight:400,color:v>max?'var(--sev-danger-fg)':'var(--text-muted)'}}>{t('Max '+max+' — largest linked facility','الحد الأقصى '+max+' — أكبر مرفق مرتبط')}</div></div><SA.InputNumber value={v} onChange={x=>setOv({...ov,[id]:x})} invalid={v>max} max={undefined}/></div>;})}</div>}
      <SA.Field label={t('Eligible staff','المدربون المؤهلون')}><SA.MultiSelect value={['noura','reem']} filter options={Object.entries(KIT.coaches).map(([k,c])=>({label:t(c.en,c.ar),value:k}))}/></SA.Field>
      <SA.Field label={t('Linked facilities','المرافق المرتبطة')} help={t('Empty = any facility at the branch.','فارغ = أي مرفق في الفرع.')}><SA.MultiSelect value={['studioA']} options={KIT.facilities.map(f=>({label:t(f.name.en,f.name.ar),value:f.id}))}/></SA.Field>
    </div>}
    {step===4&&<div style={card}>
      <SA.Field label={t('Accepted with','يُقبل عبر')} required error={!payOk?t('Choose at least one option.','اختر خيارًا واحدًا على الأقل.'):null}><div style={{display:'flex',gap:20,flexWrap:'wrap',paddingTop:4}}>{[['membership','Membership','عضوية'],['package','Package','باقة'],['dropin','Drop-in','حضور منفرد'],['free','Free','مجاني']].map(([k,en,ar])=><SA.Checkbox key={k} checked={pay[k]} invalid={!payOk} onChange={v=>setPay({...pay,[k]:v})} label={t(en,ar)}/>)}</div></SA.Field>
      {(pay.membership||pay.package)&&<SA.Field label={t('Credit cost per booking','عدد الأرصدة لكل حجز')}><SA.InputNumber value={1} unitLabel={t('credits','رصيد')} showButtons style={{maxWidth:200}}/></SA.Field>}
      <RulesBlock/>
    </div>}
    {step===5&&<div style={card}>
      <div style={{display:'flex',gap:12,alignItems:'center'}}><span style={{width:12,height:12,borderRadius:3,background:'var(--svc-2)'}}></span><span style={{font:'var(--text-h2)'}}>{t(nameEn||nameAr,nameAr)}</span><ActLabel type={type}/></div>
      {nameMissing&&<SA.Message severity="warn" icon="pi-language">{t('English name is missing.','الاسم الإنجليزي غير موجود.')}</SA.Message>}
      <div style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:'10px 24px',font:'var(--text-body)'}}>
        {[[t('Category','الفئة'),t('Mind & body','العقل والجسد')],[t('Defaults','الافتراضيات'),type==='open'?'—':t('60 min · '+cap+' people · 10 min buffer after','60 دقيقة · '+cap+' شخص · فاصل 10 دقائق بعد')],[t('Branches','الفروع'),<BranchChips ids={br} max={4}/>],[t('Staff','المدربون'),t('Noura, Reem','نورة، ريم')],[t('Accepted with','يُقبل عبر'),Object.entries(pay).filter(x=>x[1]).map(x=>x[0]).join(', ')],[t('Booking rules','قواعد الحجز'),t('Organization defaults','إعدادات المنظمة')]].map(([k,v],i)=><React.Fragment key={i}><span style={{color:'var(--text-secondary)'}}>{k}</span><span>{v}</span></React.Fragment>)}
      </div>
    </div>}
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
      <SA.Button label={t('Cancel','إلغاء')} variant="text" severity="secondary" onClick={()=>go('services')}/>
      <span style={{flex:1}}></span>
      {step>0&&<SA.Button label={t('Back','رجوع')} severity="secondary" variant="outlined" icon="pi-arrow-left pi-dir" onClick={()=>setStep(step-1)}/>}
      {step<5?<SA.Button label={t('Next','التالي')} icon="pi-arrow-right pi-dir" iconPos="end" disabled={step===4&&!payOk} onClick={next}/>:<><SA.Button label={t('Save as draft','حفظ كمسودة')} severity="secondary" onClick={()=>{go('service',{id:'padel'});toast({summary:t('Saved as draft','تم الحفظ كمسودة')});}}/><SA.Button label={t('Publish','نشر')} icon="pi-send" onClick={()=>{go('service',{id:'yoga'});toast({summary:t('Service published','تم نشر الخدمة')});}}/></>}
    </div>
  </div>;
}
Object.assign(window,{ServiceWizard});
