function ClientsScreen({go,openNew,toast}){
  const [t,lang]=useT();
  const [q,setQ]=React.useState('');const [status,setStatus]=React.useState('all');const [sel,setSel]=React.useState([]);const [drawer,setDrawer]=React.useState(!!openNew);const [sort,setSort]=React.useState(['name',1]);
  const [form,setForm]=React.useState({first:'',last:'',mobile:''});
  const rows=KIT.clients.filter(c=>(status==='all'||c.status===status)&&(!q||(c.name.en+c.name.ar+c.mid+c.phone).toLowerCase().includes(q.toLowerCase())));
  const dup=form.mobile.replace(/\s/g,'')==='0551234567';
  const br=id=>{const b=KIT.branches.find(x=>x.id===id);return t(b.name.en,b.name.ar);};
  const cols=[
    {field:'name',header:t('Client','العميل'),sortable:true,body:c=><SA.PersonChip name={t(c.name.en,c.name.ar)} secondary={c.mid} trailing={c.family&&<i className="pi pi-users" title={c.family==='parent'?t('Guardian','ولي أمر'):t('Child','طفل')} style={{fontSize:12,color:'var(--text-muted)'}}></i>}/>},
    {field:'phone',header:t('Mobile','الجوال'),body:c=><span dir="ltr" className="num" style={{color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{c.phone}</span>},
    {field:'branch',header:t('Home branch','الفرع الرئيسي'),body:c=><span style={{whiteSpace:'nowrap'}}>{br(c.branch)}</span>},
    {field:'status',header:t('Status','الحالة'),body:c=><SA.StatusTag status={c.status} lang={lang}/>},
    {field:'tags',header:t('Tags','الوسوم'),body:c=><div style={{display:'flex',gap:4}}>{c.tags.map(x=><SA.Tag key={x} size="sm" rounded>{x}</SA.Tag>)}</div>},
    {field:'last',header:t('Last visit','آخر زيارة'),sortable:true,body:c=>t(c.last.en,c.last.ar)},
    {field:'upcoming',header:t('Upcoming','القادمة'),align:'end',body:c=><span className="num">{c.upcoming}</span>}
  ];
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <SA.PageHeader title={t('Clients','العملاء')} meta={<span>{t('312 clients','312 عميلًا')}</span>} moreItems={[{label:t('Import clients','استيراد العملاء'),icon:'pi-upload'},{label:t('Export','تصدير'),icon:'pi-download'}]} primaryAction={<SA.Button label={t('New client','عميل جديد')} icon="pi-user-plus" onClick={()=>setDrawer(true)}/>}/>
    <SA.FilterBar search={q} onSearch={setQ} searchPlaceholder={t('Name, mobile, email, member ID','الاسم، الجوال، البريد، رقم العضوية')}
      filters={<><SA.Select value={status} onChange={setStatus} style={{width:160}} options={[{label:t('All statuses','كل الحالات'),value:'all'},{label:t('Active','نشط'),value:'active'},{label:t('Inactive','غير نشط'),value:'inactive'},{label:t('Blocked','محظور'),value:'blocked'},{label:t('Lead','محتمل'),value:'lead'}]}/><SA.MultiSelect value={[]} placeholder={t('Segment','الشريحة')} options={[{label:'VIP',value:'vip'},{label:t('Low attendance','حضور منخفض'),value:'low'}]} style={{width:150}}/></>}
      onMoreFilters={()=>{}} moreLabel={t('More filters','فلاتر إضافية')} moreCount={status!=='all'?1:0}
      chips={status!=='all'?[{label:t('Status: ','الحالة: ')+status,onRemove:()=>setStatus('all')}]:[]} onClearAll={()=>setStatus('all')} clearLabel={t('Clear all','مسح الكل')}/>
    <SA.BulkActionBar count={sel.length} label={sel.length+' '+t('selected','محدد')} clearLabel={t('Clear','مسح')} onClear={()=>setSel([])} actions={<><SA.Button size="sm" severity="contrast" label={t('Add tag','إضافة وسم')} icon="pi-tag"/><SA.Button size="sm" severity="contrast" label={t('Add to segment','إضافة لشريحة')} icon="pi-filter"/><SA.Button size="sm" severity="contrast" label={t('Export','تصدير')} icon="pi-download"/></>}/>
    <SA.DataTable columns={cols} rows={rows} selectable selection={sel} onSelectionChange={setSel} sortField={sort[0]} sortOrder={sort[1]} onSort={(f,o)=>setSort([f,o])} onRowClick={c=>go('client',{id:c.id})} pagination={{page:1,rows:25,total:312,label:t('1–25 of 312','1–25 من 312')}}
      emptyState={<SA.EmptyState icon="pi-search" title={t('No clients match','لا يوجد عملاء مطابقون')} description={t('Try a different name, mobile or member ID.','جرّب اسمًا أو رقم جوال أو رقم عضوية مختلفًا.')} action={<SA.Button label={t('New client','عميل جديد')} icon="pi-user-plus" onClick={()=>setDrawer(true)}/>}/>}/>
    {drawer&&<SA.EntityDrawer title={t('New client','عميل جديد')} subtitle={t('Home branch: Olaya','الفرع الرئيسي: العليا')} onCancel={()=>setDrawer(false)} saveLabel={t('Save client','حفظ العميل')} cancelLabel={t('Cancel','إلغاء')} saveDisabled={!form.first||dup} onSave={()=>{setDrawer(false);toast({summary:t('Client created','تم إنشاء العميل'),detail:form.first+' '+form.last,actions:<><SA.Button size="sm" variant="text" label={t('Book now','احجز الآن')}/><SA.Button size="sm" variant="text" severity="secondary" label={t('Add a child','إضافة طفل')}/></>});}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('First name','الاسم الأول')} required><SA.InputText value={form.first} onChange={v=>setForm({...form,first:v})}/></SA.Field><SA.Field label={t('Last name','اسم العائلة')} required><SA.InputText value={form.last} onChange={v=>setForm({...form,last:v})}/></SA.Field></div>
      <SA.Field label={t('Mobile','الجوال')} required help={t('Try 055 123 4567 to see the duplicate check','جرّب 055 123 4567 لرؤية فحص التكرار')}><SA.InputText value={form.mobile} onChange={v=>setForm({...form,mobile:v})} dir="ltr" prefix="+966" inputMode="tel" invalid={dup}/></SA.Field>
      {dup&&<SA.WhyNotMessage severity="warn" reason={t('A client with this mobile already exists','يوجد عميل بنفس رقم الجوال')} detail={t('Sara Al-Otaibi (M-10234)','سارة العتيبي (M-10234)')} secondaryAction={<SA.Button size="sm" variant="outlined" severity="warn" label={t('Open profile','فتح الملف')} onClick={()=>{setDrawer(false);go('client',{id:'c1'});}}/>}/>}
      <SA.Field label={t('Email','البريد الإلكتروني')}><SA.InputText dir="ltr" type="email"/></SA.Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><SA.Field label={t('Date of birth','تاريخ الميلاد')}><SA.DatePicker placeholder={t('Pick a date','اختر تاريخًا')} locale={lang}/></SA.Field><SA.Field label={t('Gender','الجنس')}><SA.SelectButton fullWidth value="f" options={[{label:t('Female','أنثى'),value:'f'},{label:t('Male','ذكر'),value:'m'}]}/></SA.Field></div>
      <SA.Button variant="text" icon="pi-chevron-down" label={t('More details','تفاصيل إضافية')} style={{alignSelf:'flex-start'}}/>
    </SA.EntityDrawer>}
  </div>;
}
function ClientProfile({id,go,onBook}){
  const [t,lang]=useT();const c=clientById(id)||KIT.clients[0];const [tab,setTab]=React.useState('overview');
  const card={background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',padding:16};
  const alerts=[];if(c.alerts.includes('waiver'))alerts.push(<SA.Tag key="w" severity="warn" icon="pi-file-edit">{t('Waiver missing','الإقرار غير موقّع')}</SA.Tag>);if(c.alerts.includes('blocked'))alerts.push(<SA.Tag key="b" severity="danger" icon="pi-ban">{t('Blocked: ','محظور: ')+t(c.blockReason.en,c.blockReason.ar)}</SA.Tag>);if(c.alerts.includes('health'))alerts.push(<SA.Tag key="h" severity="danger" icon="pi-heart">{t('Health note','ملاحظة صحية')}</SA.Tag>);if(c.alerts.includes('unpaid'))alerts.push(<SA.Tag key="u" severity="warn" icon="pi-wallet">{t('Unpaid desk payment','دفعة غير مسددة')}</SA.Tag>);
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <SA.Breadcrumb items={[{label:t('Clients','العملاء'),onClick:e=>{e.preventDefault();go('clients');}},{label:t(c.name.en,c.name.ar)}]}/>
    <div style={{...card,display:'flex',gap:20,alignItems:'center',flexWrap:'wrap',padding:20}}>
      <SA.Avatar name={t(c.name.en,c.name.ar)} size="xl"/>
      <div style={{flex:1,minWidth:240,display:'flex',flexDirection:'column',gap:6}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}><h1 style={{margin:0,font:'var(--text-h1)'}}>{t(c.name.en,c.name.ar)}</h1><SA.StatusTag status={c.status} lang={lang}/></div>
        <div style={{display:'flex',gap:16,font:'var(--text-small)',color:'var(--text-secondary)',flexWrap:'wrap'}}><span style={{fontFamily:'var(--font-mono)'}}>{c.mid}</span><span dir="ltr">+966 {c.phone}</span><span><i className="pi pi-map-marker" style={{fontSize:12,marginInlineEnd:4}}></i>{t('Olaya branch','فرع العليا')}</span></div>
        {alerts.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>{alerts}</div>}
      </div>
      <div style={{display:'flex',gap:8}}><SA.Button icon="pi-phone" severity="secondary" variant="outlined" ariaLabel="Call"/><SA.Button icon="pi-envelope" severity="secondary" variant="outlined" ariaLabel="Email"/><SA.Button label={t('Check in','تسجيل حضور')} icon="pi-qrcode" severity="secondary" onClick={()=>go('checkin')}/><SA.Button label={t('Book','حجز')} icon="pi-plus" disabled={c.status==='blocked'} onClick={()=>onBook()}/></div>
    </div>
    <SA.Tabs value={tab} onChange={setTab} tabs={[{label:t('Overview','نظرة عامة'),value:'overview'},{label:t('Bookings','الحجوزات'),value:'bookings'},{label:t('Attendance','الحضور'),value:'attendance'},{label:t('Family','العائلة'),value:'family'},{label:t('Waivers','الإقرارات'),value:'waivers'},{label:t('Notes','الملاحظات'),value:'notes'},{label:t('Memberships','العضويات'),value:'mem',disabled:true,hint:t('Available in a later release','متاح في إصدار لاحق')},{label:t('Timeline','السجل'),value:'timeline'}]}/>
    {tab==='overview'?<div style={{display:'grid',gridTemplateColumns:'minmax(0,2fr) minmax(0,1fr)',gap:16}}>
      <div style={card}><div style={{font:'var(--text-h3)',marginBottom:12}}>{t('Upcoming bookings','الحجوزات القادمة')}</div>{KIT.sessions.slice(3,6).map(s=><div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderTop:'1px solid var(--border-subtle)'}}><SA.TimeLabel date={t('Tue','الثلاثاء')} time={s.start} style={{width:90}}/><span style={{flex:1}}>{sessName(s,t)}</span><SA.StatusTag status="confirmed" lang={lang} size="sm"/><SA.StatusTag status="unpaid" lang={lang} size="sm" label={t('Pay at desk','الدفع في الاستقبال')}/></div>)}</div>
      <div style={{display:'flex',flexDirection:'column',gap:16}}><div style={card}><div style={{font:'var(--text-h3)',marginBottom:12}}>{t('Family','العائلة')}</div><div style={{display:'flex',flexDirection:'column',gap:10}}><SA.PersonChip name={t('Yousef Al-Shammari','يوسف الشمري')} secondary={t('Child · 9 years','طفل · 9 سنوات')}/><SA.PersonChip name={t('Ahmed Al-Otaibi','أحمد العتيبي')} secondary={t('Co-guardian','ولي أمر مشارك')}/></div></div><div style={card}><div style={{font:'var(--text-h3)',marginBottom:4}}>{t('Attendance (30 days)','الحضور (30 يومًا)')}</div><div style={{font:'var(--text-display)'}} className="num">86%</div><div style={{font:'var(--text-small)',color:'var(--text-secondary)'}}>{t('12 visits this month','12 زيارة هذا الشهر')}</div></div></div>
    </div>:<div style={card}><SA.EmptyState compact icon="pi-eye-slash" title={t('Not recreated in this UI kit','غير متضمَّن في هذه المجموعة')} description={t('See brief 06 for this tab.','راجع الموجز 06 لهذا التبويب.')}/></div>}
  </div>;
}
Object.assign(window,{ClientsScreen,ClientProfile});
