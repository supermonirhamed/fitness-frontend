// Sample data + tiny helpers for the Admin UI kit (plain JS, loaded after React).
(function(){
const NS='StudioAdminDesignSystem_50d047';
window.SA=new Proxy({},{get:(_,k)=>(window[NS]||{})[k]});
window.LangCtx=React.createContext('ar');
window.useT=function(){const l=React.useContext(window.LangCtx);return [function(en,ar){return l==='ar'?ar:en;},l];};
const n=(en,ar)=>({en,ar});
window.KIT={
  org:n('Elite Club','نادي النخبة'),
  today:n('Tuesday, 7 October 2026','الثلاثاء، 7 أكتوبر 2026'),
  branches:[{id:'olaya',name:n('Olaya branch','فرع العليا'),tz:'AST'},{id:'malqa',name:n('Al Malqa branch','فرع الملقا'),tz:'AST'},{id:'dubai',name:n('Dubai Marina','دبي مارينا'),tz:'GST'}],
  facilities:[{id:'studioA',name:n('Studio A','استوديو أ'),cap:20},{id:'hall',name:n('Main hall','القاعة الرئيسية'),cap:25},{id:'pool',name:n('Pool','المسبح'),cap:12},{id:'court',name:n('Court 2','الملعب 2'),cap:10}],
  coaches:{noura:n('Noura Al-Shehri','نورة الشهري'),khalid:n('Khalid Al-Dosari','خالد الدوسري'),faisal:n('Faisal Al-Mutairi','فيصل المطيري'),reem:n('Reem Al-Zahrani','ريم الزهراني')},
  sessions:[
    {id:'s1',svc:n('Morning Yoga','يوغا الصباح'),color:'var(--svc-2)',start:'07:00',end:'08:00',coach:'noura',fac:'studioA',booked:9,cap:15,wait:0,status:'completed'},
    {id:'s2',svc:n('Kids Swim — Level 1','سباحة أطفال — المستوى 1'),color:'var(--svc-1)',start:'16:00',end:'16:45',coach:'faisal',fac:'pool',booked:8,cap:8,wait:2,status:'full'},
    {id:'s3',svc:n('Strength Basics','أساسيات القوة'),color:'var(--svc-7)',start:'17:00',end:'18:00',coach:'khalid',fac:'hall',booked:13,cap:16,wait:0,status:'published'},
    {id:'s4',svc:n('Yoga Flow','يوغا فلو'),color:'var(--svc-2)',start:'18:00',end:'19:00',coach:'noura',fac:'studioA',booked:12,cap:15,wait:0,status:'published'},
    {id:'s5',svc:n('HIIT 45','هيت 45'),color:'var(--svc-3)',start:'19:00',end:'19:45',coach:'khalid',fac:'hall',booked:20,cap:20,wait:3,status:'full'},
    {id:'s6',svc:n('Padel Clinic','تدريب بادل'),color:'var(--svc-6)',start:'19:00',end:'20:30',coach:'faisal',fac:'court',booked:4,cap:8,wait:0,status:'draft'},
    {id:'s7',svc:n('Pilates Mat','بيلاتس'),color:'var(--svc-4)',start:'20:00',end:'21:00',coach:'reem',fac:'studioA',booked:6,cap:12,wait:0,status:'cancelled'},
    {id:'s8',svc:n('Aqua Fit','أكوا فت'),color:'var(--svc-5)',start:'20:00',end:'20:45',coach:'reem',fac:'pool',booked:5,cap:12,wait:0,status:'published'}
  ],
  clients:[
    {id:'c1',name:n('Sara Al-Otaibi','سارة العتيبي'),mid:'M-10234',phone:'055 123 4567',status:'active',branch:'olaya',tags:['VIP'],last:n('Today','اليوم'),upcoming:3,alerts:['waiver'],family:'parent'},
    {id:'c2',name:n('Omar Al-Harbi','عمر الحربي'),mid:'M-10235',phone:'055 987 6543',status:'blocked',branch:'olaya',tags:[],last:n('3 Oct','3 أكتوبر'),upcoming:0,alerts:['blocked'],blockReason:n('Unpaid balance','رصيد غير مدفوع')},
    {id:'c3',name:n('Noura Al-Qahtani','نورة القحطاني'),mid:'M-10236',phone:'056 111 2233',status:'active',branch:'malqa',tags:['Morning'],last:n('6 Oct','6 أكتوبر'),upcoming:1,alerts:[]},
    {id:'c4',name:n('Lama Al-Ghamdi','لمى الغامدي'),mid:'M-10241',phone:'050 445 1290',status:'lead',branch:'olaya',tags:[],last:n('—','—'),upcoming:0,alerts:[]},
    {id:'c5',name:n('Yousef Al-Shammari','يوسف الشمري'),mid:'M-10252',phone:'053 778 0012',status:'active',branch:'olaya',tags:['Swim'],last:n('5 Oct','5 أكتوبر'),upcoming:2,alerts:['health'],family:'child'},
    {id:'c6',name:n('Hessa Al-Malki','حصة المالكي'),mid:'M-10260',phone:'059 210 8877',status:'inactive',branch:'dubai',tags:[],last:n('12 Aug','12 أغسطس'),upcoming:0,alerts:[]},
    {id:'c7',name:n('Abdullah Al-Rashid','عبدالله الراشد'),mid:'M-10271',phone:'055 300 4410',status:'active',branch:'olaya',tags:['PT'],last:n('Today','اليوم'),upcoming:4,alerts:['unpaid']}
  ],
  roster:[
    {id:'r1',client:'c1',status:'confirmed',pay:'unpaid',flags:['waiver']},
    {id:'r2',client:'c3',status:'checked-in',pay:'paid',flags:[]},
    {id:'r3',client:'c5',status:'confirmed',pay:'complimentary',flags:['first','health']},
    {id:'r4',client:'c7',status:'checked-in',pay:'paid',flags:[]},
    {id:'r5',client:'c4',status:'late-cancel',pay:'unpaid',flags:['first']}
  ],
  waitlist:[{client:'c6',joined:'5 Oct, 21:04'},{client:'c4',joined:'6 Oct, 08:30'},{client:'c2',joined:'6 Oct, 12:11'}],
  alerts:[
    {type:'conflict',icon:'pi-exclamation-triangle',sev:'danger',t:n('Coach double-booked','تعارض في جدول المدرب'),d:n('Khalid · HIIT 45 and PT session at 19:00','خالد · هيت 45 وجلسة خاصة الساعة 19:00')},
    {type:'waitlist',icon:'pi-users',sev:'warn',t:n('Full with waitlist, starts in 2h','ممتلئة مع قائمة انتظار، تبدأ خلال ساعتين'),d:n('Kids Swim — Level 1 · 2 waiting','سباحة أطفال — المستوى 1 · 2 بالانتظار')},
    {type:'payment',icon:'pi-wallet',sev:'warn',t:n('3 unpaid "pay at desk" bookings','3 حجوزات "الدفع في الاستقبال" غير مدفوعة'),d:n('Yoga Flow 18:00, Strength Basics 17:00','يوغا فلو 18:00، أساسيات القوة 17:00')}
  ]
};
})();
