import type en from './en'

const ar: typeof en = {
  common: {
    language: 'English',
    retry: 'إعادة المحاولة',
    cancel: 'إلغاء',
    close: 'إغلاق',
    signOut: 'تسجيل الخروج',
    loading: 'جارٍ التحميل…',
    genericError: 'حدث خطأ. حاول مرة أخرى.',
  },
  status: {
    Provisioning: 'قيد التجهيز',
    Failed: 'فشل',
    Active: 'نشط',
    Suspended: 'موقوف',
  },
  platform: {
    consoleName: 'لوحة المنصة',
    signIn: {
      title: 'لوحة المنصة',
      subtitle: 'سجّل الدخول كمسؤول للمنصة',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      showPassword: 'إظهار كلمة المرور',
      remember: 'تذكرني',
      submit: 'تسجيل الدخول',
    },
    sessionExpired: 'تم تسجيل خروجك، سجّل الدخول مرة أخرى.',
    tenants: {
      title: 'المنظمات',
      subtitle: 'لكل منظمة نطاق فرعي وقاعدة بيانات خاصة بها.',
      new: 'منظمة جديدة',
      empty: 'لا توجد منظمات بعد',
      emptyHint: 'أنشئ أول منظمة ليحصل النشاط على مساحة عمل خاصة به.',
      loadError: 'تعذّر تحميل المنظمات.',
      columns: {
        name: 'المنظمة',
        subdomain: 'النطاق الفرعي',
        owner: 'المالك',
        status: 'الحالة',
        created: 'تاريخ الإنشاء',
      },
    },
    create: {
      title: 'منظمة جديدة',
      orgSection: 'المنظمة',
      ownerSection: 'المالك',
      defaultsSection: 'الإعدادات الافتراضية',
      name: 'اسم المنظمة',
      slug: 'النطاق الفرعي',
      slugHelp: 'أحرف إنجليزية صغيرة وأرقام وشرطات. لا يمكن تغييره لاحقًا.',
      checking: 'جارٍ التحقق…',
      available: 'متاح',
      reason: {
        invalid: 'استخدم من 3 إلى 40 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة مفردة.',
        reserved: 'هذا النطاق الفرعي محجوز.',
        taken: 'هذا النطاق الفرعي مستخدم.',
      },
      ownerName: 'اسم المالك',
      ownerEmail: 'بريد المالك',
      ownerHelp: 'سنرسل دعوة لتعيين كلمة المرور.',
      currency: 'العملة',
      timezone: 'المنطقة الزمنية الافتراضية',
      timezoneHelp: 'يمكن لكل فرع أن تكون له منطقته الزمنية لاحقًا.',
      language: 'اللغة',
      submit: 'إنشاء المنظمة',
      provisioningTitle: 'جارٍ تجهيز {name}',
      provisioningBody:
        'ننشئ قاعدة البيانات والأدوار والإعدادات الافتراضية. يستغرق ذلك عادة بضع ثوانٍ.',
      activeTitle: '{name} جاهزة',
      activeBody: 'تم إرسال دعوة إلى {email}.',
      openWorkspace: 'فتح مساحة العمل',
      failedTitle: 'تعذّر تجهيز {name}',
      failedBody: 'لم يُفقد أي شيء. أعد المحاولة لإكمال التجهيز.',
    },
  },
  tenantApp: {
    comingSoon: 'تسجيل دخول المنظمات سيتوفر في الإصدار القادم.',
  },
}

export default ar
