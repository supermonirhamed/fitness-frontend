const CAL_START=6,CAL_END=22,HOUR=80;
const toMin=s=>{const [h,m]=s.split(':').map(Number);return h*60+m;};
const fromMin=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const WEEK=[['Sat 4','السبت 4'],['Sun 5','الأحد 5'],['Mon 6','الاثنين 6'],['Tue 7','الثلاثاء 7'],['Wed 8','الأربعاء 8'],['Thu 9','الخميس 9'],['Fri 10','الجمعة 10']];
const TODAY_IDX=3;
function weekSessions(base){return WEEK.flatMap((_,i)=>base.filter((s,j)=>i===TODAY_IDX||(i+j)%3!==0).filter(s=>i!==6||toMin(s.start)>=960).map(s=>({...s,id:i===TODAY_IDX?s.id:s.id+'-'+i,base:s.id,day:i,status:i<TODAY_IDX?(s.status==='draft'?'cancelled':s.status==='cancelled'?'cancelled':'completed'):i===TODAY_IDX?s.status:(s.status==='completed'?'published':s.status),booked:i>TODAY_IDX?Math.max(0,s.booked-(i*2)%5):s.booked})));}
function withLanes(list){const sorted=[...list].sort((a,b)=>toMin(a.start)-toMin(b.start));const out=[];let cl=[],ends=[],clEnd=-1;const flush=()=>{const n=Math.max(1,ends.length);cl.forEach(s=>s.n=n);cl=[];ends=[];};sorted.forEach(s0=>{const s={...s0};if(toMin(s.start)>=clEnd)flush();let l=ends.findIndex(e=>e<=toMin(s.start));if(l<0){l=ends.length;ends.push(0);}ends[l]=toMin(s.end);clEnd=Math.max(clEnd,toMin(s.end));s.lane=l;cl.push(s);out.push(s);});flush();return {items:out,n:1};}
function SessionPopover({s,onClose,go,onBook,onCancel,zone}){
  const [t,lang]=useT();const f=KIT.facilities.find(x=>x.id===s.fac);const past=s.status==='completed',canc=s.status==='cancelled';
  return <div onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} style={{position:'absolute',zIndex:20,top:'calc(100% + 6px)',insetInlineStart:0,width:290,padding:14,background:'var(--surface-overlay)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',boxShadow:'var(--shadow-2)',display:'flex',flexDirection:'column',gap:10,cursor:'default'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8}}><div><div style={{font:'var(--text-h4)'}}>{sessName(s,t)}</div><SA.TimeLabel time={s.start} end={s.end} zone="AST" showZone={zone} style={{fontSize:13,color:'var(--text-secondary)'}}/></div><SA.StatusTag status={s.status} lang={lang} size="sm"/></div>
    <SA.PersonChip size="md" name={t(KIT.coaches[s.coach].en,KIT.coaches[s.coach].ar)} secondary={t(f.name.en,f.name.ar)}/>
    <SA.CapacityIndicator booked={s.booked} capacity={s.cap} waitlist={s.wait} cancelled={canc} lang={lang}/>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      <SA.Button size="sm" label={t('Open','فتح')} onClick={()=>go('session',{id:s.base||s.id})}/>
      {!past&&!canc&&<SA.Button size="sm" severity="secondary" label={t('Add booking','إضافة حجز')} icon="pi-plus" onClick={()=>{onClose();onBook(s.base||s.id);}}/>}
      {!canc&&<SA.Button size="sm" severity="secondary" variant="outlined" label={t('Check-in roster','قائمة الحضور')} icon="pi-check-square" onClick={()=>go('session-mobile',{id:s.base||s.id})}/>}
      {!past&&!canc&&<SA.Button size="sm" severity="secondary" variant="text" icon="pi-pencil" ariaLabel={t('Edit','تعديل')} onClick={()=>go('session',{id:s.base||s.id})}/>}
      {!past&&!canc&&<SA.Button size="sm" severity="danger" variant="text" icon="pi-times-circle" ariaLabel={t('Cancel session','إلغاء الحصة')} onClick={()=>{onClose();onCancel(s);}}/>}
    </div>
    {past&&<div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)'}}><i className="pi pi-lock" style={{fontSize:10,marginInlineEnd:4}}></i>{t('Past session — read-only except attendance','حصة سابقة — للعرض فقط عدا الحضور')}</div>}
  </div>;
}
function CalSplitNew({onSession,onEvent,onAppt}){
  const [t]=useT();const [o,setO]=React.useState(false);
  return <div style={{position:'relative',display:'flex'}} onClick={e=>e.stopPropagation()}><SA.Button label={t('New session','حصة جديدة')} icon="pi-plus" onClick={onSession} style={{borderStartEndRadius:0,borderEndEndRadius:0}}/><SA.Button icon="pi-chevron-down" ariaLabel={t('More','المزيد')} onClick={()=>setO(!o)} style={{borderStartStartRadius:0,borderEndStartRadius:0,borderInlineStart:'1px solid rgba(255,255,255,.3)'}}/>{o&&<div style={{position:'absolute',top:'calc(100% + 4px)',insetInlineEnd:0,zIndex:30}} onClick={()=>setO(false)}><SA.Menu items={[{label:t('Session or series','حصة أو سلسلة'),icon:'pi-calendar-plus',onClick:onSession},{label:t('Event (multi-day)','فعالية (عدة أيام)'),icon:'pi-star',onClick:onEvent},{label:t('Appointment from availability','موعد حسب التوفر'),icon:'pi-user',onClick:onAppt}]}/></div>}</div>;
}
function CalendarScreen({go,onBook,toast,role,branch}){
  const [t,lang]=useT();
  const [view,setView]=React.useState('day');const [res,setRes]=React.useState('facility');const [sel,setSel]=React.useState(null);const [draft,setDraft]=React.useState(null);const [event,setEvent]=React.useState(false);const [cancel,setCancel]=React.useState(null);
  const [sessions,setSessions]=React.useState(()=>KIT.sessions.map(s=>({...s})));
  const [drag,setDrag]=React.useState(null);const [selMode,setSelMode]=React.useState(false);const [picked,setPicked]=React.useState([]);const [loading,setLoading]=React.useState(false);
  const [fFac,setFFac]=React.useState([]);const [fCoach,setFCoach]=React.useState([]);const [fStatus,setFStatus]=React.useState([]);const [fType,setFType]=React.useState('all');
  const isCoach=role==='coach';const [mine,setMine]=React.useState(isCoach?'mine':'all');
  const allBr=branch==='all';
  const passes=s=>(!fFac.length||fFac.includes(s.fac))&&(!fCoach.length||fCoach.includes(s.coach))&&(!fStatus.length||fStatus.includes(s.status))&&(mine!=='mine'||s.coach==='reem');
  const vis=sessions.filter(passes);
  const changeView=v=>{setView(v);setSel(null);if(v==='week'||v==='list'){setLoading(true);setTimeout(()=>setLoading(false),600);}};
  React.useEffect(()=>{if(!drag)return;const mv=e=>setDrag(d=>d&&{...d,dy:e.clientY-d.y0});const up=e=>{const d={...drag,dy:e.clientY-drag.y0};setDrag(null);finish(d);};window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);return()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);};},[drag&&drag.id,drag&&drag.mode]);
  const finish=d=>{
    const s=sessions.find(x=>x.id===d.id);if(!s)return;
    if(Math.abs(d.dy)<4){if(selMode)setPicked(p=>p.includes(s.id)?p.filter(x=>x!==s.id):[...p,s.id]);else setSel(sel===s.id?null:s.id);return;}
    if(s.status==='completed'||s.status==='cancelled'){toast({severity:'warn',summary:t('Past and cancelled sessions are read-only','الحصص السابقة والملغاة للعرض فقط')});return;}
    const delta=Math.round(d.dy/HOUR*60/15)*15;let ns=toMin(s.start),ne=toMin(s.end);
    if(d.mode==='move'){ns+=delta;ne+=delta;}else{ne=Math.max(ns+15,ne+delta);}
    if(ns<CAL_START*60||ne>CAL_END*60)return;
    const o=sessions.find(x=>x.id!==s.id&&x.status!=='cancelled'&&(x.fac===s.fac||x.coach===s.coach)&&toMin(x.start)<ne&&toMin(x.end)>ns);
    if(o){const why=o.fac===s.fac?t(KIT.facilities.find(f=>f.id===o.fac).name.en+' is busy',KIT.facilities.find(f=>f.id===o.fac).name.ar+' محجوز'):t(KIT.coaches[o.coach].en+' is busy',KIT.coaches[o.coach].ar+' مشغول');toast({severity:'danger',summary:t("Can't move — ","لا يمكن النقل — ")+why,detail:sessName(o,t)+' '+o.start+'–'+o.end});return;}
    setSessions(sessions.map(x=>x.id===s.id?{...x,start:fromMin(ns),end:fromMin(ne)}:x));
    toast({summary:(d.mode==='move'?t('Moved to ','نُقلت إلى '):t('Duration changed · ','تم تغيير المدة · '))+fromMin(ns)+'–'+fromMin(ne),detail:s.booked?t(s.booked+' booked clients will be notified.','سيتم إشعار '+s.booked+' عميلًا محجوزًا.'):null});
  };
  const bulk=kind=>{const ps=sessions.filter(s=>picked.includes(s.id));if(kind==='publish'){setSessions(sessions.map(s=>picked.includes(s.id)&&s.status==='draft'?{...s,status:'published'}:s));toast({summary:t(ps.filter(s=>s.status==='draft').length+' sessions published','تم نشر '+ps.filter(s=>s.status==='draft').length+' حصص')});}else{const blocked=ps.filter(s=>s.booked>0&&s.status!=='draft');setSessions(sessions.map(s=>picked.includes(s.id)&&s.booked===0&&s.status==='published'?{...s,status:'draft'}:s));if(blocked.length)toast({severity:'warn',summary:t(blocked.length+" sessions have bookings and can't be unpublished",blocked.length+' حصص فيها حجوزات ولا يمكن إلغاء نشرها'),detail:t('Cancel them instead.','قم بإلغائها بدلًا من ذلك.')});}setPicked([]);};
  const cols=res==='facility'?KIT.facilities.map(f=>({id:f.id,label:t(f.name.en,f.name.ar),sub:t('Cap. ','السعة ')+f.cap})):Object.entries(KIT.coaches).filter(([id])=>mine!=='mine'||id==='reem').map(([id,c])=>({id,label:t(c.en,c.ar)}));
  const hours=[];for(let h=CAL_START;h<CAL_END;h++)hours.push(h);const H=(CAL_END-CAL_START)*HOUR;
  const y=m=>(m-CAL_START*60)/60*HOUR;
  const shade=(from,to,label,hatch)=><div style={{position:'absolute',top:y(from),height:y(to)-y(from),insetInline:0,background:hatch?'repeating-linear-gradient(135deg,var(--surface-sunken) 0 6px,transparent 6px 12px)':'color-mix(in srgb,var(--surface-sunken) 70%,transparent)',pointerEvents:'none',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:6}}>{label&&<span style={{font:'600 11px var(--font-sans)',color:'var(--text-muted)',background:'var(--surface-card)',padding:'2px 8px',borderRadius:999,border:'1px solid var(--border-default)'}}>{label}</span>}</div>;
  const hourGutter=<div style={{position:'relative',height:H}}>{hours.map(h=><div key={h} dir="ltr" style={{position:'absolute',top:(h-CAL_START)*HOUR-7,insetInlineEnd:8,font:'500 11px var(--font-sans)',color:'var(--text-muted)',fontVariantNumeric:'tabular-nums'}}>{h>CAL_START?String(h).padStart(2,'0')+':00':''}</div>)}</div>;
  const gridBg={position:'relative',height:H,borderInlineStart:'1px solid var(--border-subtle)',backgroundImage:'repeating-linear-gradient(to bottom,var(--border-subtle) 0 1px,transparent 1px '+HOUR+'px)'};
  const card=(s,lane,n,compact,draggable)=>{const top=y(toMin(s.start)),h=y(toMin(s.end))-top;const d=drag&&drag.id===s.id?drag:null;const w=100/n;const isPicked=picked.includes(s.id);
    return <div key={s.id} style={{position:'absolute',top:top+1+(d&&d.mode==='move'?d.dy:0),height:h-2+(d&&d.mode==='resize'?d.dy:0),insetInlineStart:'calc('+(lane*w)+'% + 3px)',width:'calc('+w+'% - 6px)',zIndex:sel===s.id||d?10:1,cursor:draggable&&!selMode?'grab':'pointer',touchAction:'none',opacity:d?.85:1}}
      onPointerDown={draggable?e=>{if(e.button!==0)return;e.preventDefault();setDrag({id:s.id,mode:'move',y0:e.clientY,dy:0});}:undefined}
      onClick={e=>{e.stopPropagation();if(draggable)return;if(selMode)setPicked(p=>p.includes(s.id)?p.filter(x=>x!==s.id):[...p,s.id]);else setSel(sel===s.id?null:s.id);}}>
      <SA.SessionCard service={sessName(s,t)} color={s.color} time={s.start} end={s.end} coach={!compact&&res==='facility'?t(KIT.coaches[s.coach].en,KIT.coaches[s.coach].ar):undefined} booked={s.booked} capacity={s.cap} waitlist={s.wait} status={s.status} variant={compact&&n>1?'mini':compact||h<100||n>1?'compact':'full'} lang={lang} selected={sel===s.id||isPicked} style={{height:'100%'}}/>
      {selMode&&<span style={{position:'absolute',top:4,insetInlineEnd:4,pointerEvents:'none'}}><SA.Checkbox checked={isPicked} size={16}/></span>}
      {draggable&&!selMode&&s.status!=='completed'&&s.status!=='cancelled'&&<div onPointerDown={e=>{e.stopPropagation();e.preventDefault();setDrag({id:s.id,mode:'resize',y0:e.clientY,dy:0});}} style={{position:'absolute',bottom:0,insetInline:8,height:8,cursor:'ns-resize'}}><span style={{display:'block',width:24,height:3,margin:'3px auto 0',borderRadius:2,background:'var(--border-strong)'}}></span></div>}
      {sel===s.id&&!selMode&&<SessionPopover s={s} zone={allBr} onClose={()=>setSel(null)} go={go} onBook={onBook} onCancel={setCancel}/>}
    </div>;};
  const emptyBranch=branch==='malqa';
  let body;
  if(emptyBranch)body=<div style={{padding:'48px 0'}}><SA.EmptyState icon="pi-calendar-plus" title={t('No sessions at Al Malqa branch yet','لا توجد حصص في فرع الملقا بعد')} description={t('Create the first session or a weekly series to fill the calendar.','أنشئ أول حصة أو سلسلة أسبوعية لملء التقويم.')} action={<SA.Button label={t('New session','حصة جديدة')} icon="pi-plus" onClick={()=>setDraft({})}/>}/></div>;
  else if(loading)body=<div style={{padding:16,display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:10}}>{Array.from({length:7}).map((_,i)=><div key={i} style={{display:'flex',flexDirection:'column',gap:10}}><SA.Skeleton height={18} width="60%"/>{Array.from({length:3+(i%3)}).map((_,j)=><SA.Skeleton key={j} height={44+(j%2)*24} radius={8}/>)}</div>)}</div>;
  else if(view==='day')body=<div style={{display:'grid',gridTemplateColumns:'56px repeat('+cols.length+',minmax(160px,1fr))',minWidth:56+cols.length*160}}>
    <div style={{position:'sticky',top:0,zIndex:12,background:'var(--surface-card)',borderBottom:'1px solid var(--border-default)'}}></div>
    {cols.map(c=><div key={c.id} style={{position:'sticky',top:0,zIndex:12,padding:'10px 12px',background:'var(--surface-card)',borderBottom:'1px solid var(--border-default)',borderInlineStart:'1px solid var(--border-subtle)'}}><div style={{font:'var(--text-h4)'}}>{c.label}</div>{c.sub&&<div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)'}}>{c.sub}</div>}</div>)}
    {hourGutter}
    {cols.map(c=>{const {items,n}=withLanes(vis.filter(s=>(res==='facility'?s.fac:s.coach)===c.id));return <div key={c.id} style={gridBg} onClick={e=>{if(e.target!==e.currentTarget||selMode)return;e.stopPropagation();const h=Math.floor(e.nativeEvent.offsetY/HOUR)+CAL_START;setDraft({fac:res==='facility'?c.id:undefined,coach:res==='coach'?c.id:undefined,start:String(h).padStart(2,'0')+':00'});}}>
      {shade(720,960,t('Outside business hours','خارج ساعات العمل'))}
      {res==='facility'&&c.id==='pool'&&shade(480,660,t('Maintenance · closed','صيانة · مغلق'),true)}
      {items.map(s=>card(s,s.lane,s.n,false,true))}
    </div>;})}
  </div>;
  else if(view==='week'){const ws=weekSessions(vis);body=<div style={{display:'grid',gridTemplateColumns:'56px repeat(7,minmax(150px,1fr))',minWidth:56+7*150}}>
    <div style={{position:'sticky',top:0,zIndex:12,background:'var(--surface-card)',borderBottom:'1px solid var(--border-default)'}}></div>
    {WEEK.map((d,i)=><div key={i} style={{position:'sticky',top:0,zIndex:12,padding:'10px 12px',background:'var(--surface-card)',borderBottom:'1px solid var(--border-default)',borderInlineStart:'1px solid var(--border-subtle)',color:i===TODAY_IDX?'var(--primary)':'var(--text-primary)'}}><div style={{font:'var(--text-h4)'}}>{t(d[0],d[1])}</div>{i===TODAY_IDX&&<div style={{font:'var(--text-caption)'}}>{t('Today','اليوم')}</div>}</div>)}
    {hourGutter}
    {WEEK.map((d,i)=>{const {items,n}=withLanes(ws.filter(s=>s.day===i));return <div key={i} style={{...gridBg,background:i<TODAY_IDX?'color-mix(in srgb,var(--surface-sunken) 35%,transparent)':undefined}}>
      {i===6?shade(360,960,t('Closed','مغلق')):shade(720,960,null)}
      {items.map(s=>card(s,s.lane,s.n,true,false))}
    </div>;})}
  </div>;}
  else if(view==='month'){const startD=new Date(2026,8,26);const cells=Array.from({length:42},(_,i)=>{const d=new Date(startD);d.setDate(startD.getDate()+i);return d;});
    body=<div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(100px,1fr))'}}>{WEEK.map((d,i)=><div key={i} style={{padding:'8px 10px',borderBottom:'1px solid var(--border-default)',font:'600 12px var(--font-sans)',color:'var(--text-secondary)'}}>{t(d[0].split(' ')[0],d[1].split(' ')[0])}</div>)}
      {cells.map((d,i)=>{const inM=d.getMonth()===9;const dn=d.getDate();const fri=d.getDay()===5;const n=inM?(fri?1:((dn*7)%5)+2):0;const list=Array.from({length:n},(_,j)=>vis[(dn+j)%vis.length]).filter(Boolean);const today=inM&&dn===7;
        return <div key={i} style={{minHeight:118,padding:6,borderBottom:'1px solid var(--border-subtle)',borderInlineStart:i%7?'1px solid var(--border-subtle)':0,background:inM?'transparent':'var(--surface-sunken)',display:'flex',flexDirection:'column',gap:3}}>
          <span className="num" style={{alignSelf:'flex-start',minWidth:24,height:24,padding:'0 6px',borderRadius:999,display:'flex',alignItems:'center',justifyContent:'center',font:'600 12px var(--font-sans)',background:today?'var(--primary)':'transparent',color:today?'var(--text-on-primary)':inM?'var(--text-primary)':'var(--text-disabled)'}}>{dn}</span>
          {list.slice(0,2).map((s,j)=><SA.SessionCard key={j} variant="mini" service={sessName(s,t)} color={s.color} time={s.start} status={dn<7?'completed':s.status} onClick={()=>{setView('day');}}/>)}
          {list.length>2&&<button type="button" onClick={()=>setView('day')} style={{alignSelf:'flex-start',border:0,background:'transparent',padding:'0 4px',font:'500 11px var(--font-sans)',color:'var(--text-link)',cursor:'pointer'}}>{t('+'+(list.length-2)+' more','+'+(list.length-2)+' أخرى')}</button>}
        </div>;})}
    </div>;}
  else {const ws=weekSessions(vis).filter(s=>s.day>=TODAY_IDX);body=<div>{WEEK.map((d,i)=>{const l=ws.filter(s=>s.day===i).sort((a,b)=>toMin(a.start)-toMin(b.start));if(i<TODAY_IDX)return null;return <div key={i}><div style={{position:'sticky',top:0,zIndex:2,padding:'8px 16px',background:'var(--surface-50)',borderBottom:'1px solid var(--border-default)',font:'var(--text-h4)',color:i===TODAY_IDX?'var(--primary)':'var(--text-primary)'}}>{t(d[0],d[1])}{i===TODAY_IDX&&' · '+t('Today','اليوم')}</div>{l.map(s=><div key={s.id} onClick={()=>go('session',{id:s.base||s.id})} style={{display:'grid',gridTemplateColumns:'96px minmax(140px,1fr) minmax(0,140px) 100px auto',gap:12,alignItems:'center',padding:'10px 16px',borderBottom:'1px solid var(--border-subtle)',cursor:'pointer'}}><SA.TimeLabel time={s.start} end={s.end} zone="AST" showZone={allBr}/><span style={{display:'flex',gap:8,alignItems:'center',minWidth:0}}><span style={{width:8,height:8,borderRadius:2,background:s.color,flex:'none'}}></span><span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',textDecoration:s.status==='cancelled'?'line-through':'none'}}>{sessName(s,t)}</span></span><span style={{font:'var(--text-small)',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{t(KIT.coaches[s.coach].en,KIT.coaches[s.coach].ar)}</span><SA.CapacityIndicator booked={s.booked} capacity={s.cap} waitlist={s.wait} cancelled={s.status==='cancelled'} size="sm" lang={lang}/><SA.StatusTag status={s.status} lang={lang} size="sm"/></div>)}</div>;})}</div>;}
  const title=view==='day'?t(KIT.today.en,KIT.today.ar):view==='month'?t('October 2026','أكتوبر 2026'):t('4 – 10 Oct 2026','4 – 10 أكتوبر 2026');
  return <div style={{display:'flex',flexDirection:'column',gap:12,height:'100%'}} onClick={()=>setSel(null)}>
    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <h1 style={{margin:0,font:'var(--text-h1)',marginInlineEnd:8}}>{t('Calendar','التقويم')}</h1>
      <SA.Button label={t('Today','اليوم')} severity="secondary" variant="outlined" size="sm"/>
      <SA.Button icon="pi-chevron-left pi-dir" severity="secondary" variant="text" size="sm" ariaLabel={t('Previous','السابق')}/><SA.Button icon="pi-chevron-right pi-dir" severity="secondary" variant="text" size="sm" ariaLabel={t('Next','التالي')}/>
      <span onClick={e=>e.stopPropagation()}><SA.Popover width="auto" style={{padding:0,border:0,background:'transparent',boxShadow:'none'}} trigger={<SA.Button label={title} iconPos="end" icon="pi-chevron-down" variant="text" severity="contrast"/>}><SA.DatePicker inline value="2026-10-07" locale={lang}/></SA.Popover></span>
      <span style={{flex:1}}></span>
      {isCoach&&<SA.SelectButton value={mine} onChange={setMine} options={[{label:t('My sessions','حصصي'),value:'mine'},{label:t('All sessions','كل الحصص'),value:'all'}]}/>}
      <SA.SelectButton value={view} onChange={changeView} options={[{label:t('Day','يوم'),value:'day'},{label:t('Week','أسبوع'),value:'week'},{label:t('Month','شهر'),value:'month'},{label:t('List','قائمة'),value:'list'}]}/>
      {!isCoach&&<CalSplitNew onSession={()=>setDraft({})} onEvent={()=>setEvent(true)} onAppt={()=>go('availability')}/>}
    </div>
    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}} onClick={e=>e.stopPropagation()}>
      <SA.MultiSelect value={fFac} onChange={setFFac} placeholder={t('Facility','المرفق')} display="comma" options={KIT.facilities.map(f=>({label:t(f.name.en,f.name.ar),value:f.id}))} style={{width:150}}/>
      <SA.MultiSelect value={fCoach} onChange={setFCoach} placeholder={t('Coach','المدرب')} display="comma" options={Object.entries(KIT.coaches).map(([k,c])=>({label:t(c.en,c.ar),value:k}))} style={{width:150}}/>
      <SA.Select value={fType} onChange={setFType} style={{width:150}} options={[{label:t('All types','كل الأنواع'),value:'all'},...Object.entries(ACT).map(([k,a])=>({label:t(a[1],a[2]),value:k,icon:a[0]}))]}/>
      <SA.MultiSelect value={fStatus} onChange={setFStatus} placeholder={t('Status','الحالة')} display="comma" options={['draft','published','full','cancelled','completed'].map(s=>({label:t(SA.STATUS_MAP?SA.STATUS_MAP[s][1]:s,SA.STATUS_MAP?SA.STATUS_MAP[s][2]:s),value:s}))} style={{width:150}}/>
      {(fFac.length+fCoach.length+fStatus.length>0)&&<SA.Button size="sm" variant="text" severity="secondary" label={t('Clear','مسح')} onClick={()=>{setFFac([]);setFCoach([]);setFStatus([]);}}/>}
      <span style={{flex:1}}></span>
      {view==='day'&&<SA.SelectButton value={res} onChange={setRes} options={[{label:t('Facilities','المرافق'),value:'facility',icon:'pi-building'},{label:t('Coaches','المدربون'),value:'coach',icon:'pi-user'}]}/>}
      {!isCoach&&<SA.Button size="sm" label={t('Conflicts','التعارضات')} icon="pi-exclamation-triangle" severity="warn" variant="outlined" badge={4} onClick={()=>go('conflicts')}/>}
      {!isCoach&&<SA.Button size="sm" label={selMode?t('Done','تم'):t('Select','تحديد')} icon={selMode?'pi-check':'pi-check-square'} severity="secondary" variant={selMode?'solid':'outlined'} onClick={()=>{setSelMode(!selMode);setPicked([]);setSel(null);}}/>}
    </div>
    {allBr&&<SA.Message severity="info" icon="pi-clock">{t("Showing all branches — times are in each branch's timezone.",'عرض كل الفروع — الأوقات بتوقيت كل فرع.')}</SA.Message>}
    {selMode&&<SA.BulkActionBar count={picked.length||0.0001} label={picked.length?t(picked.length+' selected',picked.length+' محددة'):t('Click sessions to select them','اضغط على الحصص لتحديدها')} clearLabel={t('Clear','مسح')} onClear={()=>setPicked([])} actions={<><SA.Button size="sm" severity="contrast" label={t('Publish','نشر')} icon="pi-send" disabled={!picked.length} onClick={()=>bulk('publish')}/><SA.Button size="sm" severity="contrast" label={t('Unpublish','إلغاء النشر')} icon="pi-eye-slash" disabled={!picked.length} onClick={()=>bulk('unpublish')}/></>}/>}
    {view==='day'&&!selMode&&!emptyBranch&&<div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)'}}><i className="pi pi-arrows-v" style={{fontSize:10,marginInlineEnd:4}}></i>{t('Drag a session to move it, or its bottom edge to change duration. Click an empty slot to create.','اسحب الحصة لنقلها، أو حافتها السفلية لتغيير المدة. اضغط على مكان فارغ للإنشاء.')}</div>}
    <div style={{flex:1,minHeight:0,background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',overflow:'auto',userSelect:drag?'none':'auto'}}>{body}</div>
    {draft&&<NewSessionDrawer prefill={draft} onClose={()=>setDraft(null)} onSaved={sum=>{setDraft(null);toast({summary:sum||t('Session saved','تم حفظ الحصة'),detail:t('Drafts are not visible to clients until published.','المسودات لا تظهر للعملاء حتى النشر.')});}}/>}
    {event&&<EventDrawer onClose={()=>setEvent(false)} onSaved={()=>{setEvent(false);toast({summary:t('Event saved','تم حفظ الفعالية')});}}/>}
    {cancel&&<CancelSessionDialog session={cancel} onCancel={()=>setCancel(null)} onConfirm={()=>{setSessions(sessions.map(x=>x.id===cancel.id?{...x,status:'cancelled'}:x));setCancel(null);toast({summary:t('Session cancelled','تم إلغاء الحصة'),detail:t('Clients were notified.','تم إشعار العملاء.'),severity:'info'});}}/>}
  </div>;
}
Object.assign(window,{CalendarScreen,toMin,WEEK});
