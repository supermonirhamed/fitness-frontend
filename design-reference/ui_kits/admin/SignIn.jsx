function SignIn({onSignIn,onLang}){
  const [t,lang]=useT();
  const [email,setEmail]=React.useState('reem@eliteclub.sa');
  const [pw,setPw]=React.useState('');const [show,setShow]=React.useState(false);const [err,setErr]=React.useState(null);const [busy,setBusy]=React.useState(false);
  const submit=e=>{e.preventDefault();if(pw==='wrong'||!pw){setErr(t('Email or password is incorrect.','البريد الإلكتروني أو كلمة المرور غير صحيحة.'));return;}setBusy(true);setTimeout(onSignIn,500);};
  return <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'var(--bg-app)'}}>
    <div style={{position:'fixed',top:16,insetInlineEnd:16}}><SA.Button variant="text" severity="secondary" label={lang==='ar'?'English':'العربية'} icon="pi-globe" onClick={onLang}/></div>
    <form onSubmit={submit} style={{width:400,maxWidth:'100%',background:'var(--surface-card)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-dialog)',boxShadow:'var(--shadow-1)',padding:32,display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,marginBottom:4}}>
        <span style={{width:56,height:56,borderRadius:12,border:'1px dashed var(--border-strong)',background:'var(--surface-sunken)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)'}}><i className="pi pi-image" style={{fontSize:20}}></i></span>
        <div style={{font:'var(--text-h2)'}}>{t(KIT.org.en,KIT.org.ar)}</div>
        <div style={{font:'var(--text-small)',color:'var(--text-secondary)'}}>{t('Sign in to manage your club','سجّل الدخول لإدارة ناديك')}</div>
      </div>
      {err&&<SA.Message severity="danger">{err}</SA.Message>}
      <SA.Field label={t('Email','البريد الإلكتروني')}><SA.InputText value={email} onChange={setEmail} dir="ltr" type="email" icon="pi-envelope"/></SA.Field>
      <SA.Field label={t('Password','كلمة المرور')}>
        <div style={{position:'relative'}}><SA.InputText value={pw} onChange={v=>{setPw(v);setErr(null);}} type={show?'text':'password'} invalid={!!err} placeholder="••••••••"/>
        <button type="button" onClick={()=>setShow(!show)} aria-label={t('Show password','إظهار كلمة المرور')} style={{position:'absolute',top:0,bottom:0,insetInlineEnd:6,border:0,background:'transparent',color:'var(--text-muted)',cursor:'pointer'}}><i className={'pi '+(show?'pi-eye-slash':'pi-eye')}></i></button></div>
      </SA.Field>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><SA.Checkbox checked label={t('Keep me signed in','تذكرني')}/><a href="#" onClick={e=>e.preventDefault()} style={{font:'500 13px var(--font-sans)'}}>{t('Forgot password?','نسيت كلمة المرور؟')}</a></div>
      <SA.Button type="submit" label={t('Sign in','تسجيل الدخول')} size="lg" fullWidth loading={busy}/>
      <div style={{font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)',textAlign:'center'}}>{t('Type "wrong" as the password to see the error state.','اكتب "wrong" ككلمة مرور لرؤية حالة الخطأ.')}</div>
    </form>
    <div dir="ltr" style={{marginTop:16,font:'var(--text-caption)',fontWeight:400,color:'var(--text-muted)'}}>eliteclub.platform.com</div>
  </div>;
}
Object.assign(window,{SignIn});
