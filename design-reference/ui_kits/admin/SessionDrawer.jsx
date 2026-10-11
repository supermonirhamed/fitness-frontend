const pad2=n=>String(n).padStart(2,'0');
const isoD=d=>d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
const WD=[['sat',6,'Sat','سبت'],['sun',0,'Sun','أحد'],['mon',1,'Mon','اثنين'],['tue',2,'Tue','ثلاثاء'],['wed',3,'Wed','أربعاء'],['thu',4,'Thu','خميس'],['fri',5,'Fri','جمعة']];
function seriesDates(days,every,ends,endDate,count){
  const out=[];const d=new Date(2026,9,7);const wanted=days.map(k=>WD.find(w=>w[0]===k)[1]);const lim=ends==='after'?count:ends==='never'?12:60;
  for(let i=0;i<400&&out.length<lim;i++){const wk=Math.floor(i/7);if(wk%every===0&&wanted.includes(d.getDay())){if(ends==='date'&&isoD(d)>endDate)break;out.push(new Date(d));}d.setDate(d.getDate()+1);}
  return out;
}
function NewSessionDrawer({prefill={},onClose,onSaved}){
  const [t,lang]=useT();
  const pre=prefill.svc?SERVICES.find(s=>s.id===prefill.svc):null;
  const [svc,setSvc]=React.useState(pre);const [q,setQ]=React.useState('');
  const [branch,setBranch]=React.useState('olaya');const [fac,setFac]=React.useState(prefill.fac||'studioA');const [coach,setCoach]=React.useState(prefill.coach||'noura');
  const [date,setDate]=React.useState('2026-10-07');const [start,setStart]=React.useState(prefill.start||'18:00');const [dur,setDur]=React.useState(pre?pre.dur:60);const [cap,setCap]=React.useState(pre?pre.cap:15);const [st,setSt]=React.useState('draft');
  const [rep,setRep]=React.useState('none');const [days,setDays]=React.useState(['sun','tue']);const [every,setEvery]=React.useState(1);const [ends,setEnds]=React.useState('date');const [endDate,setEndDate]=React.useState('2026-12-15');const [count,setCount]=React.useState(24);
  const [preview,setPreview]=React.useState(false);const [skip,setSkip]=React.useState(null);
  const facCap=KIT.facilities.find(f=>f.id===fac).cap;
  const pick=s=>{setSvc(s);if(s.dur)setDur(s.dur);if(s.cap)setCap(Math.min(s.cap,facCap));};
  const sug=q?SERVICES.filter(s=>s.status!=='archived'&&s.type!=='open'&&(s.name.en+s.name.ar).toLowerCase().includes(q.toLowerCase())).map(s=>({...s,label:svcName(s,t),sub:t(ACT[s.type][1],ACT[s.type][2])+(s.dur?' · '+s.dur+t(' min',' د'):''),avatar:false})):[];
  const linked=['studioA'];
  const facOpts=[...KIT.facilities].sort((a,b)=>(linked.includes(b.id)?1:0)-(linked.includes(a.id)?1:0)).map(f=>({label:t(f.name.en,f.name.ar),value:f.id,meta:t('cap. ','سعة ')+f.cap,sub:linked.includes(f.id)?t('Linked to this service','مرتبط بهذه الخدمة'):undefined}));
  const coachOpts=[{label:t(KIT.coaches.noura.en,KIT.coaches.noura.ar),value:'noura',sub:t('Eligible · free','مؤهلة · متاحة')},{label:t(KIT.coaches.reem.en,KIT.coaches.reem.ar),value:'reem',sub:t('Eligible · on leave 7–9 Oct','مؤهلة · في إجازة 7–9 أكتوبر')},{label:t(KIT.coaches.khalid.en,KIT.coaches.khalid.ar),value:'khalid',disabled:true,sub:t('Busy 19:00–19:45 · HIIT 45','مشغول 19:00–19:45 · هيت 45')},{label:t(KIT.coaches.faisal.en,KIT.coaches.faisal.ar),value:'faisal',disabled:true,sub:t('Not qualified for this service','غير مؤهل لهذه الخدمة')}];
  const sm=Number(start.split(':')[0])*60+Number(start.split(':')[1]);const em=sm+(dur||0);
  const conflicts=[];
  if(fac==='studioA'&&sm<19*60&&em>18*60)conflicts.push({level:'hard',title:t('Facility busy','المرفق محجوز'),who:t('Studio A · Yoga Flow','استوديو أ · يوغا فلو'),when:'18:00–19:00',href:'#session/s4',linkLabel:t('Open','فتح')});
  if(coach==='noura'&&sm<19*60&&em>18*60&&fac!=='studioA')conflicts.push({level:'hard',title:t('Coach busy','المدرب مشغول'),who:t(KIT.coaches.noura.en,KIT.coaches.noura.ar),when:t('Yoga Flow 18:00–19:00','يوغا فلو 18:00–19:00'),href:'#session/s4',linkLabel:t('Open','فتح')});
  if(cap>facCap)conflicts.push({level:'hard',title:t('Capacity above facility limit','السعة أكبر من سعة المرفق'),when:t('Max ','الحد الأقصى ')+facCap});
  if(coach==='reem')conflicts.push({level:'soft',title:t('Coach on time off','المدرب في إجازة'),who:t(KIT.coaches.reem.en,KIT.coaches.reem.ar),when:t('Annual leave 7–9 Oct','إجازة سنوية 7–9 أكتوبر')});
  if(em>22*60||(sm<16*60&&em>12*60))conflicts.push({level:'soft',title:t('Outside business hours','خارج ساعات العمل'),when:t('Open 06:00–12:00, 16:00–22:00','مفتوح 06:00–12:00، 16:00–22:00')});
  if(date>='2026-12-01'&&date<='2026-12-03')conflicts.push({level:'soft',title:t('Holiday','عطلة'),when:t('Maintenance closure 1–3 Dec','إغلاق للصيانة 1–3 ديسمبر')});
  const hard=conflicts.some(c=>c.level==='hard');const soft=conflicts.filter(c=>c.level==='soft').length;
  const occ=rep==='weekly'?seriesDates(days,every,ends,endDate,count):[];
  const flag=d=>{const s=isoD(d);if(s>='2026-12-01'&&s<='2026-12-03')return ['holiday',t('Holiday · maintenance closure','عطلة · إغلاق للصيانة')];if(s==='2026-10-27')return ['conflict',t('Coach busy · PT 18:00','المدرب مشغول · تدريب خاص 18:00')];return null;};
  const skips=skip||new Set(occ.filter(flag).map(isoD));
  const fmt=d=>new Intl.DateTimeFormat(lang==='ar'?'ar-SA-u-nu-latn-ca-gregory':'en-GB',{weekday:'short',day:'numeric',month:'short'}).format(d);
  const make=occ.length-occ.filter(d=>skips.has(isoD(d))).length;
  const sumLine=t(make+' sessions will be created, '+(occ.length-make)+' skipped',make+' حصة سيتم إنشاؤها، و'+(occ.length-make)+' متخطاة');
  const toggleSkip=k=>{const n=new Set(skips);n.has(k)?n.delete(k):n.add(k);setSkip(n);};
  if(preview)return <SA.EntityDrawer title={t('Preview series','معاينة السلسلة')} subtitle={sumLine} onCancel={onClose} cancelLabel={t('Cancel','إلغاء')} saveLabel={t('Create '+make+' sessions','إنشاء '+make+' حصة')} onSave={()=>onSaved(sumLine)} footerStart={<SA.Button label={t('Back','رجوع')} icon="pi-arrow-left pi-dir" variant="text" severity="secondary" onClick={()=>setPreview(false)}/>}>
    <SA.Message severity={occ.length-make?'warn':'info'}>{sumLine}{ends==='never'&&<div>{t('Rolling: new sessions keep being added 8 weeks ahead.','مستمرة: تُضاف حصص جديدة باستمرار قبل 8 أسابيع.')}</div>}</SA.Message>
    <div style={{border:'1px solid var(--border-default)',borderRadius:8}}>{occ.map((d,i)=>{const k=isoD(d);const f=flag(d);const sk=skips.has(k);return <div key={k} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',borderBottom:'1px solid var(--border-subtle)',background:sk?'var(--surface-sunken)':'transparent'}}>
      <SA.Checkbox checked={!sk} onChange={()=>toggleSkip(k)}/>
      <span className="num" style={{width:28,font:'var(--text-caption)',color:'var(--text-muted)'}}>#{i+1}</span>
      <span style={{flex:1,font:'500 14px var(--font-sans)',textDecoration:sk?'line-through':'none',color:sk?'var(--text-muted)':'var(--text-primary)'}}>{fmt(d)} · <span dir="ltr">{start}</span></span>
      {f&&<SA.Tag size="sm" severity={f[0]==='holiday'?'warn':'danger'} icon={f[0]==='holiday'?'pi-calendar-times':'pi-exclamation-triangle'}>{f[1]}</SA.Tag>}
      {sk&&<SA.Tag size="sm">{t('Skipped','متخطاة')}</SA.Tag>}
    </div>;})}</div>
  </SA.EntityDrawer>;
  return <SA.EntityDrawer title={t('New session','حصة جديدة')} subtitle={t('Times in AST · Asia/Riyadh','الأوقات بتوقيت AST · Asia/Riyadh')} onCancel={onClose} cancelLabel={t('Cancel','إلغاء')}
    saveDisabled={!svc||hard||(rep==='weekly'&&days.length===0)} saveLabel={rep==='weekly'?t('Preview '+occ.length+' sessions','معاينة '+occ.length+' حصة'):soft?t('Save anyway','حفظ رغم التحذير'):t('Save session','حفظ الحصة')}
    onSave={()=>rep==='weekly'?setPreview(true):onSaved()}
    footerStart={conflicts.length>0&&<span style={{font:'var(--text-small)',color:hard?'var(--sev-danger-fg)':'var(--sev-warn-fg)'}}><i className={'pi '+(hard?'pi-times-circle':'pi-exclamation-triangle')} style={{marginInlineEnd:6}}></i>{hard?t('Resolve conflicts to save','حلّ التعارضات للحفظ'):t(soft+' warning'+(soft>1?'s':''),soft+' تحذير')}</span>}>
    <SA.Field label={t('Service','الخدمة')} required>{svc?<div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',border:'1px solid var(--border-default)',borderRadius:6}}><span style={{width:10,height:10,borderRadius:3,background:svc.color}}></span><span style={{flex:1,font:'500 14px var(--font-sans)'}}>{svcName(svc,t)}</span><ActLabel type={svc.type}/><SA.Button size="sm" variant="text" severity="secondary" label={t('Change','تغيير')} onClick={()=>setSvc(null)}/></div>:<SA.AutoComplete value={q} onChange={setQ} suggestions={sug} onSelect={pick} placeholder={t('Search services','ابحث عن خدمة')} emptyMessage={t('No services','لا توجد خدمات')}/>}</SA.Field>
    {svc&&<div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)',marginTop:-8}}><i className="pi pi-sparkles" style={{fontSize:11,marginInlineEnd:4}}></i>{t('Defaults filled from the service.','تم ملء القيم الافتراضية من الخدمة.')}</div>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      <SA.Field label={t('Branch','الفرع')}><SA.Select value={branch} onChange={setBranch} options={allBranches().filter(b=>b.status!=='archived').map(b=>({label:t(b.name.en,b.name.ar),value:b.id,meta:b.tz}))}/></SA.Field>
      <SA.Field label={t('Facility','المرفق')} required><SA.Select value={fac} onChange={setFac} options={facOpts}/></SA.Field>
      <SA.Field label={t('Coach','المدرب')} required><SA.Select value={coach} onChange={setCoach} options={coachOpts}/></SA.Field>
      <SA.Field label={t('Date','التاريخ')}><SA.DatePicker value={date} onChange={setDate} locale={lang}/></SA.Field>
      <SA.Field label={t('Start time','وقت البدء')}><SA.DatePicker mode="time" value={start} onChange={setStart}/></SA.Field>
      <SA.Field label={t('Duration','المدة')}><SA.InputNumber mode="minutes" unitLabel={t('min','دقيقة')} value={dur} onChange={setDur} step={15} showButtons/></SA.Field>
      <SA.Field label={t('Capacity','السعة')} help={t('Max ','الحد الأقصى ')+facCap+t(' (facility)',' (المرفق)')} error={cap>facCap?t('Above facility capacity','أكبر من سعة المرفق'):null}><SA.InputNumber value={cap} onChange={v=>setCap(v||0)} invalid={cap>facCap} showButtons/></SA.Field>
      <SA.Field label={t('Status','الحالة')}><SA.SelectButton fullWidth value={st} onChange={setSt} options={[{label:t('Draft','مسودة'),value:'draft'},{label:t('Published','منشور'),value:'published'}]}/></SA.Field>
    </div>
    <div style={{borderTop:'1px solid var(--border-default)',paddingTop:16,display:'flex',flexDirection:'column',gap:12}}>
      <SA.Field label={t('Repeat','التكرار')}><SA.SelectButton value={rep} onChange={setRep} options={[{label:t('Does not repeat','لا يتكرر'),value:'none'},{label:t('Weekly','أسبوعيًا'),value:'weekly'}]}/></SA.Field>
      {rep==='weekly'&&<>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{WD.map(([k,,en,ar])=>{const on=days.includes(k);return <SA.Button key={k} size="sm" label={t(en,ar)} severity={on?'primary':'secondary'} variant={on?'solid':'outlined'} onClick={()=>setDays(on?days.filter(x=>x!==k):[...days,k])}/>;})}</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}><span>{t('Every','كل')}</span><SA.InputNumber value={every} onChange={v=>setEvery(Math.max(1,v||1))} showButtons style={{width:110}}/><span>{t('week(s)','أسبوع')}</span></div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}><span style={{font:'var(--text-small)',fontWeight:500}}>{t('Ends','ينتهي')}</span>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><SA.RadioButton name="ends" value="date" checked={ends==='date'} onChange={setEnds} label={t('On date','في تاريخ')}/>{ends==='date'&&<SA.DatePicker value={endDate} onChange={setEndDate} locale={lang} style={{width:180}}/>}</div>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><SA.RadioButton name="ends" value="after" checked={ends==='after'} onChange={setEnds} label={t('After','بعد')}/>{ends==='after'&&<SA.InputNumber value={count} onChange={v=>setCount(v||1)} unitLabel={t('occurrences','مرة')} style={{width:170}}/>}</div>
          <SA.RadioButton name="ends" value="never" checked={ends==='never'} onChange={setEnds} label={t('Never (rolling)','بدون نهاية (مستمرة)')} description={t('Sessions are added 8 weeks ahead.','تُضاف الحصص قبل 8 أسابيع.')}/>
        </div>
      </>}
    </div>
    <div style={{borderTop:'1px solid var(--border-default)',paddingTop:16}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span style={{font:'var(--text-h4)'}}>{t('Conflicts','التعارضات')}</span>{conflicts.length===0&&<SA.Tag size="sm" severity="success" icon="pi-check">{t('None','لا يوجد')}</SA.Tag>}</div>{conflicts.length>0&&<SA.ConflictList items={conflicts}/>}</div>
  </SA.EntityDrawer>;
}
function EventDrawer({onClose,onSaved}){
  const [t,lang]=useT();
  const [rows,setRows]=React.useState([['2027-07-05','09:00','13:00'],['2027-07-06','09:00','13:00'],['2027-07-07','09:00','13:00']]);
  return <SA.EntityDrawer title={t('New event','فعالية جديدة')} subtitle={t('One registration covers all dates','تسجيل واحد يشمل كل التواريخ')} onCancel={onClose} onSave={onSaved} cancelLabel={t('Cancel','إلغاء')} saveLabel={t('Save event','حفظ الفعالية')} width="var(--drawer-w-lg)">
    <SA.Field label={t('Service','الخدمة')} required><SA.Select value="camp" options={SERVICES.filter(s=>s.type==='event').map(s=>({label:svcName(s,t),value:s.id,icon:'pi-star'}))}/></SA.Field>
    <SA.Field label={t('Dates & times','التواريخ والأوقات')}><div style={{display:'flex',flexDirection:'column',gap:8}}>{rows.map((r,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><span className="num" style={{width:24,font:'var(--text-caption)',color:'var(--text-muted)'}}>{i+1}</span><SA.DatePicker value={r[0]} locale={lang} style={{width:170}}/><div dir="ltr" style={{display:'flex',gap:6,alignItems:'center'}}><SA.DatePicker mode="time" value={r[1]} style={{width:104}}/><span>–</span><SA.DatePicker mode="time" value={r[2]} style={{width:104}}/></div><SA.Button icon="pi-trash" size="sm" variant="text" severity="secondary" ariaLabel={t('Remove','حذف')} onClick={()=>setRows(rows.filter((_,j)=>j!==i))}/></div>)}<SA.Button label={t('Add date','إضافة تاريخ')} icon="pi-plus" variant="text" size="sm" style={{alignSelf:'flex-start'}} onClick={()=>setRows([...rows,['2027-07-08','09:00','13:00']])}/></div></SA.Field>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Facility','المرفق')}><SA.Select value="hall" options={KIT.facilities.map(f=>({label:t(f.name.en,f.name.ar),value:f.id,meta:String(f.cap)}))}/></SA.Field><SA.Field label={t('Event capacity','سعة الفعالية')} help={t('Total registrations, not per day.','إجمالي التسجيلات وليس لكل يوم.')}><SA.InputNumber value={30} showButtons/></SA.Field></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Registration opens','يفتح التسجيل')}><SA.DatePicker value="2027-05-01" locale={lang}/></SA.Field><SA.Field label={t('Registration closes','يُغلق التسجيل')}><SA.DatePicker value="2027-07-01" locale={lang}/></SA.Field></div>
    <SA.Message severity="info">{t(rows.length+' sessions will be created and linked to this event.','سيتم إنشاء '+rows.length+' حصص وربطها بهذه الفعالية.')}</SA.Message>
  </SA.EntityDrawer>;
}
Object.assign(window,{NewSessionDrawer,EventDrawer});
