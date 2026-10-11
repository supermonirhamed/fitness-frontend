// Dev fallback: if _ds_bundle.js hasn't been compiled yet, transpile component sources in-browser.
// Usage: <script src="dev/ds-dev-loader.js" data-root="../.."></script> after Babel; then await window.__dsReady.
(function(){
  const NS='StudioAdminDesignSystem_50d047';
  const me=document.currentScript;const root=(me&&me.dataset.root)||'.';
  const FILES=['buttons/Button','buttons/SelectButton','feedback/Message','feedback/Skeleton','feedback/Toast','navigation/Tabs','navigation/Breadcrumb','navigation/Stepper','navigation/Menu','forms/Field','forms/InputText','forms/InputNumber','forms/Textarea','forms/Select','forms/MultiSelect','forms/AutoComplete','forms/DatePicker','forms/Checkbox','forms/RadioButton','forms/ToggleSwitch','forms/FileUpload','data/Tag','data/Badge','data/Avatar','data/Timeline','data/DataTable','overlays/Drawer','overlays/Dialog','overlays/ConfirmDialog','overlays/Popover','patterns/StatusTag','patterns/CapacityIndicator','patterns/WhyNotMessage','patterns/OverrideDialog','patterns/ConflictList','patterns/EmptyState','patterns/NoPermission','patterns/ErrorState','patterns/PersonChip','patterns/TimeLabel','patterns/Money','patterns/VatSummary','patterns/PageHeader','patterns/FilterBar','patterns/BulkActionBar','patterns/EntityDrawer','patterns/SessionCard','shell/Sidebar','shell/AppHeader','shell/BottomNav'];
  window.__dsReady=(async()=>{
    if(window[NS])return window[NS];
    const X={};
    const srcs=await Promise.all(FILES.map(f=>fetch(root+'/components/'+f+'.jsx').then(r=>r.text())));
    srcs.forEach(src=>{
      const exp=[];
      let code=src.replace(/^import React.*$/m,'').replace(/^import\s*\{([^}]+)\}\s*from.*$/gm,(_,n)=>n.split(',').map(s=>s.trim()).filter(Boolean).map(s=>'const '+s+'=(p)=>React.createElement(__X.'+s+',p);').join(''))
        .replace(/export (function|const) (\w+)/g,(_,k,n)=>{exp.push(n);return k+' '+n;});
      code='(function(__X){'+code+';'+exp.map(n=>'__X.'+n+'='+n+';').join('')+'})';
      const out=Babel.transform(code,{presets:['react']}).code;
      (0,eval)(out)(X);
    });
    window[NS]=X;return X;
  })();
})();
