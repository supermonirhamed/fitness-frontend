function sessName(s,t){return t(s.svc.en,s.svc.ar);}
function Today({go,onBook,branch}){
  const [t]=useT();
  const b=KIT.branches.find(x=>x.id===branch)||KIT.branches[0];
  const [loading,setLoading]=React.useState(true);
  React.useEffect(()=>{const h=setTimeout(()=>setLoading(false),600);return()=>clearTimeout(h);},[]);
  const facName=id=>{const f=KIT.facilities.find(x=>x.id===id);return t(f.name.en,f.name.ar);};
  const card={background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)'};
  return <div style={{display:'flex',flexDirection:'column',gap:20}}>
    <SA.PageHeader title={t('Today','اليوم')} meta={<><span>{t(KIT.today.en,KIT.today.ar)}</span><span>{t(b.name.en,b.name.ar)}</span></>}
      actions={<><SA.Button label={t('New client','عميل جديد')} icon="pi-user-plus" severity="secondary" onClick={()=>go('clients',{newClient:true})}/><SA.Button label={t('Check-in','تسجيل الحضور')} icon="pi-qrcode" severity="secondary" onClick={()=>go('checkin')}/></>}
      primaryAction={<SA.Button label={t('New booking','حجز جديد')} icon="pi-plus" onClick={()=>onBook()}/>}/>
    <div style={{display:'flex',flexWrap:'wrap',gap:20,alignItems:'flex-start'}}>
      <section style={{...card,flex:'2 1 540px',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid var(--border-default)'}}><h2 style={{margin:0,font:'var(--text-h3)'}}>{t("Today's sessions","حصص اليوم")}</h2><span style={{font:'var(--text-small)',color:'var(--text-muted)'}}>{KIT.sessions.length} {t('sessions','حصص')}</span></div>
        <ul style={{listStyle:'none',margin:0,padding:0}}>
          {loading?[1,2,3,4].map(i=><li key={i} style={{display:'flex',gap:16,alignItems:'center',padding:'14px 16px',borderBottom:'1px solid var(--border-subtle)'}}><SA.Skeleton width={48}/><div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}><SA.Skeleton width="40%"/><SA.Skeleton width="25%" height={10}/></div><SA.Skeleton width={84} height={20}/></li>):
          KIT.sessions.map(s=>{const done=s.status==='completed',canc=s.status==='cancelled';return <li key={s.id} onClick={()=>go('session',{id:s.id})} style={{display:'grid',gridTemplateColumns:'64px minmax(0,1fr) 110px 96px 28px',gap:16,alignItems:'center',padding:'12px 16px',borderBottom:'1px solid var(--border-subtle)',cursor:'pointer',opacity:done?.6:1}} onMouseEnter={e=>e.currentTarget.style.background='var(--surface-hover)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
            <div><SA.TimeLabel time={s.start} strong style={{textDecoration:canc?'line-through':'none'}}/><div dir="ltr" style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)',textAlign:'start'}}>{s.end}</div></div>
            <div style={{display:'flex',gap:10,alignItems:'center',minWidth:0}}><span style={{width:8,height:8,borderRadius:2,background:s.color,flex:'none'}}></span><div style={{minWidth:0}}><div style={{font:'500 14px/1.4 var(--font-sans)',textDecoration:canc?'line-through':'none',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{sessName(s,t)}</div><div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-secondary)'}}>{t(KIT.coaches[s.coach].en,KIT.coaches[s.coach].ar)} · {facName(s.fac)}</div></div></div>
            <SA.CapacityIndicator booked={s.booked} capacity={s.cap} waitlist={s.wait} cancelled={canc} size="sm"/>
            <div><SA.StatusTag status={s.status} lang={t('en','ar')} size="sm"/></div>
            <i className="pi pi-chevron-right pi-dir" style={{color:'var(--text-muted)',fontSize:12}}></i>
          </li>;})}
        </ul>
      </section>
      <aside style={{...card,padding:0,flex:'1 1 300px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid var(--border-default)'}}><h2 style={{margin:0,font:'var(--text-h3)'}}>{t('Needs attention','بحاجة إلى متابعة')}</h2><SA.Badge value={KIT.alerts.length}/></div>
        <ul style={{listStyle:'none',margin:0,padding:8,display:'flex',flexDirection:'column',gap:4}}>
          {KIT.alerts.map((a,i)=><li key={i} style={{display:'flex',gap:12,padding:10,borderRadius:8,cursor:'pointer'}} onClick={()=>go(a.type==='payment'?'session':'calendar',{id:'s4'})} onMouseEnter={e=>e.currentTarget.style.background='var(--surface-hover)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
            <span style={{width:32,height:32,flex:'none',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--sev-'+a.sev+'-bg)',color:'var(--sev-'+a.sev+'-fg)'}}><i className={'pi '+a.icon} style={{fontSize:14}}></i></span>
            <div style={{minWidth:0}}><div style={{font:'500 14px/1.4 var(--font-sans)'}}>{t(a.t.en,a.t.ar)}</div><div style={{font:'var(--text-small)',color:'var(--text-secondary)'}}>{t(a.d.en,a.d.ar)}</div></div>
          </li>)}
        </ul>
      </aside>
    </div>
  </div>;
}
Object.assign(window,{Today,sessName});
