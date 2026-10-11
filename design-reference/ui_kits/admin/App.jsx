const ROLES={owner:{en:'Owner',ar:'المالك',allowed:null},reception:{en:'Receptionist',ar:'موظف استقبال',allowed:['today','calendar','bookings','clients','services','checkin','branches']},manager:{en:'Branch manager',ar:'مدير الفرع',allowed:['today','calendar','bookings','clients','services','checkin','staff','branches'],branches:['olaya']},coach:{en:'Coach',ar:'مدرب',allowed:['today','calendar','clients']}};
function Placeholder({name}){const [t]=useT();return <div style={{background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)'}}><SA.EmptyState icon="pi-eye-slash" title={t(name+' is not part of this UI kit','هذه الصفحة غير متضمَّنة في المجموعة')} description={t('See the design briefs for this area.','راجع موجزات التصميم لهذا القسم.')}/></div>;}
function App(){
  const [lang,setLang]=React.useState(()=>localStorage.getItem('sa-kit-lang')||'ar');
  const [theme,setTheme]=React.useState('light');
  const [signed,setSigned]=React.useState(()=>localStorage.getItem('sa-kit-signed')!=='0');
  const parseHash=()=>{const [h,qs]=location.hash.slice(1).split('?');if(!h)return null;const r=new URLSearchParams(qs||'').get('role');if(r&&ROLES[r])setTimeout(()=>setRole(r));const [name,id]=h.split('/');const extra=Object.fromEntries([...new URLSearchParams(qs||'')].filter(([k])=>k!=='role'));return id?{name,id,...extra}:{name,...extra};};
  const [route,setRoute]=React.useState(()=>{const h=parseHash();if(h)return h;try{return JSON.parse(localStorage.getItem('sa-kit-route'))||{name:'today'};}catch(e){return {name:'today'};}});
  React.useEffect(()=>{const f=()=>{const h=parseHash();if(h){if(h.name==='signin'){setSigned(false);}else{setSigned(true);setRoute(h);}}};window.addEventListener('hashchange',f);if(location.hash==='#signin')setSigned(false);return()=>window.removeEventListener('hashchange',f);},[]);
  const [role,setRole]=React.useState('owner');const [collapsed,setCollapsed]=React.useState(false);const [branch,setBranch]=React.useState('olaya');
  const [booking,setBooking]=React.useState(null);const [toasts,setToasts]=React.useState([]);const [alertsOpen,setAlertsOpen]=React.useState(false);
  React.useEffect(()=>{document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.documentElement.lang=lang;localStorage.setItem('sa-kit-lang',lang);},[lang]);
  React.useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
  React.useEffect(()=>{localStorage.setItem('sa-kit-route',JSON.stringify(route));const h='#'+route.name+(route.id?'/'+route.id:'');if(signed&&location.hash!==h)history.replaceState(null,'',h);},[route,signed]);
  React.useEffect(()=>{localStorage.setItem('sa-kit-signed',signed?'1':'0');},[signed]);
  const t=(en,ar)=>lang==='ar'?ar:en;
  const go=(name,params={})=>setRoute({name,...params});
  const toast=tt=>{const id=Math.random();setToasts(x=>[...x,{id,...tt}]);setTimeout(()=>setToasts(x=>x.filter(y=>y.id!==id)),4500);};
  const onBook=sid=>setBooking({sid});
  const toggleLang=()=>setLang(lang==='ar'?'en':'ar');
  if(!signed)return <LangCtx.Provider value={lang}><SignIn onSignIn={()=>setSigned(true)} onLang={toggleLang}/></LangCtx.Provider>;
  const allowed=ROLES[role].allowed;const nav=route.name==='session'?'calendar':route.name==='client'?'clients':route.name==='branch'?'branches':['service','service-new','program'].includes(route.name)?'services':route.name==='categories'?'settings':route.name;
  const scope=ROLES[role].branches;
  const noAccess=(allowed&&!allowed.includes(nav))||(route.name==='branch'&&scope&&!scope.includes(route.id));
  let screen;
  if(noAccess)screen=<div style={{background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)'}}><SA.NoPermission lang={lang} action={<SA.Button label={t('Go to Today','الذهاب إلى اليوم')} onClick={()=>go('today')}/>}/></div>;
  else switch(route.name){
    case 'today':screen=<Today go={go} onBook={onBook} branch={branch}/>;break;
    case 'calendar':screen=<CalendarScreen key={role+branch} go={go} onBook={onBook} toast={toast} role={role} branch={branch}/>;break;
    case 'session':screen=<SessionScreen key={route.id} id={route.id} go={go} onBook={onBook} toast={toast}/>;break;
    case 'clients':screen=<ClientsScreen go={go} openNew={route.newClient} toast={toast}/>;break;
    case 'client':screen=<ClientProfile key={route.id} id={route.id} go={go} onBook={onBook}/>;break;
    case 'checkin':screen=<CheckInScreen toast={toast}/>;break;
    case 'settings':screen=<OrgSettings toast={toast}/>;break;
    case 'branches':screen=<BranchesScreen key={route.state||'x'} go={go} toast={toast} state={route.state}/>;break;
    case 'services':screen=<ServicesScreen key={(route.state||'')+(route.tab||'')} go={go} toast={toast} state={route.state} tab={route.tab}/>;break;
    case 'service':screen=<ServiceDetails key={route.id} id={route.id} go={go} toast={toast}/>;break;
    case 'service-new':screen=<ServiceWizard go={go} toast={toast}/>;break;
    case 'program':screen=<ProgramDetails key={route.id} id={route.id} go={go}/>;break;
    case 'categories':screen=<CategoriesScreen go={go} toast={toast}/>;break;
    case 'branch':screen=<BranchDetails key={route.id} id={route.id} go={go} toast={toast}/>;break;
    default:screen=<Placeholder name={route.name}/>;
  }
  return <LangCtx.Provider value={lang}><div style={{display:'flex',height:'100vh',background:'var(--bg-app)'}}>
    <SA.Sidebar active={nav} onNavigate={k=>go(k)} allowed={allowed||undefined} lang={lang} collapsed={collapsed} onToggle={()=>setCollapsed(!collapsed)} orgName={t(KIT.org.en,KIT.org.ar)} counts={{checkin:4}}/>
    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
      <SA.AppHeader lang={lang} onLangToggle={toggleLang} branches={KIT.branches.map(b=>({id:b.id,name:t(b.name.en,b.name.ar),tz:b.tz}))} branch={branch} onBranchChange={setBranch} alerts={KIT.alerts.length} onAlerts={()=>setAlertsOpen(true)} user={{name:t('Reem Al-Zahrani','ريم الزهراني'),role:t(ROLES[role].en,ROLES[role].ar)}}
        userMenu={[{group:t('View as','عرض كـ')},...Object.entries(ROLES).map(([k,r])=>({label:t(r.en,r.ar),icon:k===role?'pi-check':'pi-user',onClick:()=>setRole(k)})),{separator:true},{label:theme==='dark'?t('Light mode','الوضع الفاتح'):t('Dark mode','الوضع الداكن'),icon:theme==='dark'?'pi-sun':'pi-moon',onClick:()=>setTheme(theme==='dark'?'light':'dark')},{label:t('Change password','تغيير كلمة المرور'),icon:'pi-key'},{separator:true},{label:t('Sign out','تسجيل الخروج'),icon:'pi-sign-out pi-dir',onClick:()=>setSigned(false)}]}/>
      <main style={{flex:1,minHeight:0,overflow:'auto',padding:24}}>{screen}</main>
    </div>
    {booking&&<BookingDrawer sessionId={booking.sid} onClose={()=>setBooking(null)} toast={toast}/>}
    {alertsOpen&&<SA.Drawer header={t('Alerts','التنبيهات')} onHide={()=>setAlertsOpen(false)} width={400} footer={<SA.Button variant="text" label={t('Mark all read','تحديد الكل كمقروء')} onClick={()=>setAlertsOpen(false)}/>}><div style={{display:'flex',flexDirection:'column',gap:8}}>{KIT.alerts.map((a,i)=><SA.Message key={i} severity={a.sev} icon={a.icon} title={t(a.t.en,a.t.ar)}>{t(a.d.en,a.d.ar)}</SA.Message>)}</div></SA.Drawer>}
    <div style={{position:'fixed',bottom:20,insetInlineEnd:20,zIndex:80,display:'flex',flexDirection:'column',gap:8}}>{toasts.map(x=><SA.Toast key={x.id} {...x} onClose={()=>setToasts(y=>y.filter(z=>z.id!==x.id))}/>)}</div>
  </div></LangCtx.Provider>;
}
Object.assign(window,{App});
