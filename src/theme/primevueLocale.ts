import type { PrimeVueConfiguration } from 'primevue/config'

type LocaleStrings = NonNullable<PrimeVueConfiguration['locale']>

/** PrimeVue's own texts (calendar names, buttons) in Arabic (US-00.13); English is its default. */
const ar: Partial<LocaleStrings> = {
  dayNames: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  dayNamesShort: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  dayNamesMin: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
  monthNames: [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ],
  monthNamesShort: [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ],
  today: 'اليوم',
  clear: 'مسح',
  weekHeader: 'أسبوع',
  am: 'ص',
  pm: 'م',
  chooseDate: 'اختر تاريخًا',
  emptyFilterMessage: 'لا توجد نتائج',
  emptyMessage: 'لا توجد خيارات',
  emptySearchMessage: 'لا توجد نتائج',
  searchMessage: '{0} نتائج متاحة',
  selectionMessage: '{0} عناصر محددة',
  accept: 'نعم',
  reject: 'لا',
  choose: 'اختر',
  upload: 'رفع',
  cancel: 'إلغاء',
  prevMonth: 'الشهر السابق',
  nextMonth: 'الشهر التالي',
}

/** Applies the language and the organization's first day of the week to PrimeVue. */
export function applyPrimeVueLocale(
  config: PrimeVueConfiguration,
  english: LocaleStrings,
  locale: 'ar' | 'en',
  firstDayOfWeek: number,
): void {
  config.locale = { ...english, ...(locale === 'ar' ? ar : {}), firstDayOfWeek } as LocaleStrings
}
