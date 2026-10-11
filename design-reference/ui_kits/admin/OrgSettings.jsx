function SettingRow({label,help,example,children}){
  return <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1.1fr)',gap:24,padding:'16px 0',borderTop:'1px solid var(--border-subtle)',alignItems:'start'}}>
    <div><div style={{font:'500 14px/1.4 var(--font-sans)'}}>{label}</div>{help&&<div style={{font:'var(--text-small)',color:'var(--text-secondary)',marginTop:2}}>{help}</div>}{example&&<div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)',marginTop:4}}><i className="pi pi-lightbulb" style={{fontSize:11,marginInlineEnd:4}}></i>{example}</div>}</div>
    <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:0}}>{children}</div>
  </div>;
}
function PenaltyControl({value,onChange,fee,onFee}){
  const [t]=useT();
  return <><SA.SelectButton value={value} onChange={onChange} options={[{label:t('None','بدون'),value:'none'},{label:t('Consume credit','خصم رصيد'),value:'credit'},{label:t('Fixed fee','رسوم ثابتة'),value:'fee'}]}/>{value==='fee'&&<SA.InputNumber mode="currency" value={fee} onChange={onFee} style={{maxWidth:200}}/>}</>;
}
function OrgSettings({toast}){
  const [t,lang]=useT();
  const [sec,setSec]=React.useState('profile');const [dirty,setDirty]=React.useState(false);
  const [p,setP]=React.useState({open:7,close:0,cancel:6,late:'credit',lateFee:25,noshow:'fee',noFee:50,wl:'auto',wlClose:120});
  const up=(k,v)=>{setP({...p,[k]:v});setDirty(true);};
  const mark=()=>setDirty(true);
  const card={background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-card)',padding:'4px 24px 8px'};
  const nav=[['profile','pi-id-card',t('Profile','الملف التعريفي')],['localization','pi-globe',t('Localization','اللغة والمنطقة')],['policies','pi-sliders-h',t('Booking policies','سياسات الحجز')]];
  const title=nav.find(n=>n[0]===sec)[2];
  return <div style={{display:'flex',flexDirection:'column',gap:20,paddingBottom:dirty?72:0}}>
    <SA.PageHeader breadcrumb={[{label:t('Settings','الإعدادات')},{label:t('Organization','المنظمة')}]} title={t('Organization settings','إعدادات المنظمة')}/>
    <div style={{display:'flex',gap:24,alignItems:'flex-start',flexWrap:'wrap'}}>
      <nav style={{flex:'0 0 220px',display:'flex',flexDirection:'column',gap:2,position:'sticky',top:0}}>{nav.map(([k,ic,l])=><button key={k} type="button" onClick={()=>setSec(k)} style={{display:'flex',alignItems:'center',gap:10,height:38,padding:'0 12px',border:0,borderRadius:8,background:sec===k?'var(--primary-subtle)':'transparent',color:sec===k?'var(--primary-subtle-text)':'var(--text-secondary)',font:(sec===k?'600':'500')+' 14px var(--font-sans)',cursor:'pointer',textAlign:'start'}}><i className={'pi '+ic}></i>{l}</button>)}</nav>
      <div style={{flex:'1 1 560px',minWidth:0,display:'flex',flexDirection:'column',gap:12}}>
        <h2 style={{margin:0,font:'var(--text-h2)'}}>{title}</h2>
        {sec==='profile'&&<div style={card}>
          <SettingRow label={t('Logo','الشعار')} help={t('Shown on sign-in, receipts and the client app.','يظهر في صفحة الدخول والإيصالات وتطبيق العملاء.')}><SA.FileUpload variant="logo" onSelect={mark} label={t('Upload logo','رفع الشعار')} hint={t('PNG or SVG, square, up to 2 MB','PNG أو SVG، مربع، حتى 2 ميجابايت')}/></SettingRow>
          <SettingRow label={t('Display name','الاسم المعروض')} help={t('What clients see.','الاسم الذي يراه العملاء.')}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><SA.InputText value="نادي النخبة" onChange={mark} dir="rtl"/><SA.InputText value="Elite Club" onChange={mark} dir="ltr"/></div></SettingRow>
          <SettingRow label={t('Legal name','الاسم القانوني')} help={t('Printed on invoices and receipts.','يُطبع على الفواتير والإيصالات.')}><SA.InputText value="شركة النخبة للياقة البدنية" onChange={mark}/></SettingRow>
          <SettingRow label={t('Contact','التواصل')}><SA.InputText icon="pi-phone" dir="ltr" value="+966 11 456 7890" onChange={mark}/><SA.InputText icon="pi-envelope" dir="ltr" value="hello@eliteclub.sa" onChange={mark}/></SettingRow>
          <SettingRow label={t('Website','الموقع الإلكتروني')}><SA.InputText icon="pi-link" dir="ltr" value="eliteclub.sa" onChange={mark}/></SettingRow>
        </div>}
        {sec==='localization'&&<div style={card}>
          <SettingRow label={t('Currency','العملة')} help={t('Used for prices, payments and receipts.','تُستخدم في الأسعار والمدفوعات والإيصالات.')}><SA.Select value="SAR" disabled options={[{label:t('Saudi riyal (SAR)','ريال سعودي (SAR)'),value:'SAR'}]}/><SA.Message severity="info" icon="pi-lock">{t("Currency can't be changed after the first payment was recorded.",'لا يمكن تغيير العملة بعد تسجيل أول دفعة.')}</SA.Message></SettingRow>
          <SettingRow label={t('Default timezone','المنطقة الزمنية الافتراضية')} help={t('New branches start with this. Each branch can have its own.','تبدأ الفروع الجديدة بها، ولكل فرع منطقته الخاصة.')}><SA.Select value="riyadh" onChange={mark} options={[{label:'Asia/Riyadh',value:'riyadh',meta:'AST · UTC+3'},{label:'Asia/Dubai',value:'dubai',meta:'GST · UTC+4'},{label:'Asia/Kuwait',value:'kuwait',meta:'AST · UTC+3'}]}/></SettingRow>
          <SettingRow label={t('Default language','اللغة الافتراضية')}><SA.SelectButton value="ar" onChange={mark} options={[{label:'العربية',value:'ar'},{label:'English',value:'en'}]}/></SettingRow>
          <SettingRow label={t('Date format','صيغة التاريخ')} example={t('7 Oct 2026','7 أكتوبر 2026')}><SA.Select value="dmy" onChange={mark} options={[{label:'7 Oct 2026',value:'dmy'},{label:'07/10/2026',value:'num'},{label:'2026-10-07',value:'iso'}]}/></SettingRow>
          <SettingRow label={t('Time format','صيغة الوقت')} example="18:00 / 6:00 PM"><SA.SelectButton value="24" onChange={mark} options={[{label:'24h',value:'24'},{label:'12h',value:'12'}]}/></SettingRow>
          <SettingRow label={t('Week starts on','بداية الأسبوع')}><SA.SelectButton value="sat" onChange={mark} options={[{label:t('Saturday','السبت'),value:'sat'},{label:t('Sunday','الأحد'),value:'sun'},{label:t('Monday','الاثنين'),value:'mon'}]}/></SettingRow>
        </div>}
        {sec==='policies'&&<>
          <SA.Message severity="info">{t('Services, branches and single sessions can override these. Changes apply to new bookings only.','يمكن للخدمات والفروع والحصص الفردية تجاوز هذه الإعدادات. تُطبّق التغييرات على الحجوزات الجديدة فقط.')}</SA.Message>
          <div style={card}>
            <div style={{font:'var(--text-h4)',padding:'16px 0 4px'}}>{t('Booking window','نافذة الحجز')}</div>
            <SettingRow label={t('Booking opens','يفتح الحجز')} help={t('Days before the session starts.','عدد الأيام قبل بدء الحصة.')} example={t('7 → bookings for Tuesday open the Tuesday before','7 ← حجوزات الثلاثاء تفتح يوم الثلاثاء السابق')}><SA.InputNumber value={p.open} onChange={v=>up('open',v)} unitLabel={t('days before','يوم قبل')} showButtons style={{maxWidth:220}}/></SettingRow>
            <SettingRow label={t('Booking closes','يُغلق الحجز')} help={t('Minutes before start. 0 = until it starts.','دقائق قبل البدء. 0 = حتى البدء.')}><SA.InputNumber value={p.close} onChange={v=>up('close',v)} mode="minutes" unitLabel={t('min before','دقيقة قبل')} step={15} showButtons style={{maxWidth:220}}/></SettingRow>
            <div style={{font:'var(--text-h4)',padding:'16px 0 4px',borderTop:'1px solid var(--border-default)',marginTop:8}}>{t('Cancellations & no-shows','الإلغاء وعدم الحضور')}</div>
            <SettingRow label={t('Free cancellation window','مهلة الإلغاء المجاني')} help={t('Cancelling later than this counts as a late cancel.','الإلغاء بعد هذه المهلة يُحسب إلغاءً متأخرًا.')} example={t('6 → free until 12:00 for an 18:00 session','6 ← مجاني حتى 12:00 لحصة 18:00')}><SA.InputNumber value={p.cancel} onChange={v=>up('cancel',v)} unitLabel={t('hours before','ساعة قبل')} showButtons style={{maxWidth:220}}/></SettingRow>
            <SettingRow label={t('Late-cancel penalty','غرامة الإلغاء المتأخر')}><PenaltyControl value={p.late} onChange={v=>up('late',v)} fee={p.lateFee} onFee={v=>up('lateFee',v)}/></SettingRow>
            <SettingRow label={t('No-show penalty','غرامة عدم الحضور')}><PenaltyControl value={p.noshow} onChange={v=>up('noshow',v)} fee={p.noFee} onFee={v=>up('noFee',v)}/></SettingRow>
            <div style={{font:'var(--text-h4)',padding:'16px 0 4px',borderTop:'1px solid var(--border-default)',marginTop:8}}>{t('Waitlist','قائمة الانتظار')}</div>
            <SettingRow label={t('Promotion','الترقية')} help={p.wl==='auto'?t('When a spot opens, the next person is booked and notified.','عند توفر مكان، يُحجز للتالي ويتم إشعاره.'):t('Staff promote people from the waitlist by hand.','يرقّي الموظفون من قائمة الانتظار يدويًا.')}><SA.SelectButton value={p.wl} onChange={v=>up('wl',v)} options={[{label:t('Manual','يدوي'),value:'manual'},{label:t('Automatic','تلقائي'),value:'auto'}]}/></SettingRow>
            <SettingRow label={t('Waitlist closes','تُغلق قائمة الانتظار')} help={t('Minutes before start.','دقائق قبل البدء.')}><SA.InputNumber value={p.wlClose} onChange={v=>up('wlClose',v)} mode="minutes" unitLabel={t('min before','دقيقة قبل')} step={15} showButtons style={{maxWidth:220}}/></SettingRow>
          </div>
        </>}
      </div>
    </div>
    {dirty&&<div style={{position:'fixed',bottom:0,insetInlineStart:'var(--sidebar-w)',insetInlineEnd:0,zIndex:40,display:'flex',alignItems:'center',gap:12,padding:'12px 24px',background:'var(--surface-card)',borderTop:'1px solid var(--border-default)',boxShadow:'var(--shadow-2)'}}><span style={{flex:1,font:'var(--text-small)',color:'var(--text-secondary)'}}><i className="pi pi-circle-fill" style={{fontSize:8,color:'var(--sev-warn-solid)',marginInlineEnd:8}}></i>{t('Unsaved changes','تغييرات غير محفوظة')}</span><SA.Button label={t('Discard','تجاهل')} variant="text" severity="secondary" onClick={()=>setDirty(false)}/><SA.Button label={t('Save changes','حفظ التغييرات')} onClick={()=>{setDirty(false);toast({summary:t('Settings saved','تم حفظ الإعدادات')});}}/></div>}
  </div>;
}
Object.assign(window,{OrgSettings,SettingRow});
