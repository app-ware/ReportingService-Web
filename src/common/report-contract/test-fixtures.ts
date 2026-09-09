import { ReportLocale } from './report-meta';

/**
 * Payload fixtures shared by the render tests.
 *
 * These mirror what NurseryServices-Web assembles: presentation-ready strings for every
 * date, amount and amount-in-words, plus the `meta` envelope. Each factory takes overrides
 * so a test can bend one field without restating the whole tree.
 *
 * Exported from `src` rather than a `__fixtures__` folder so the compiled service does not
 * ship them; `tsconfig.build.json` excludes only `*spec.ts`, so this file is deliberately
 * small and dependency-free.
 */

/** A 1x1 transparent PNG. */
export const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

export const meta = (locale: ReportLocale) => ({ schemaVersion: 1 as const, locale });

const center = {
  name: 'Sunshine Nursery',
  address: '12 Palm Street, Cairo',
  landLine: '+20 2 1234 5678',
  logoBase64: TINY_PNG,
};

const arabicCenter = {
  name: 'حضانة أشعة الشمس',
  address: '١٢ شارع النخيل، القاهرة',
  landLine: '+20 2 1234 5678',
  logoBase64: TINY_PNG,
};

const bannerSettings = {
  useImages: true,
  includeFooter: true,
  headerImageBase64: TINY_PNG,
  footerImageBase64: TINY_PNG,
};

type Overrides = Record<string, unknown>;

/**
 * Merges overrides one level deep.
 *
 * A test almost always wants to bend a single nested field ("this incident's description"),
 * so a plain spread is wrong: it would replace the whole `incident` object and drop every
 * required sibling. Only plain objects are merged; arrays and scalars replace outright,
 * which is what a test overriding `feeLines` means.
 */
function merge<T extends Overrides>(base: T, overrides: Overrides): T {
  const result: Overrides = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    const existing = result[key];
    const bothPlainObjects =
      isPlainObject(existing) && isPlainObject(value);

    result[key] = bothPlainObjects
      ? merge(existing as Overrides, value as Overrides)
      : value;
  }

  return result as T;
}

function isPlainObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function incidentFixture(locale: ReportLocale = 'en', overrides: Overrides = {}) {
  const isArabic = locale === 'ar';

  return merge({
    meta: meta(locale),
    center: isArabic ? arabicCenter : center,
    settings: { ...bannerSettings },
    student: { name: isArabic ? 'يارا حسن محمد' : 'Yara Hassan Mohamed' },
    incident: {
      date: '26/08/2026',
      time: '7:15AM',
      title: isArabic ? 'كشط / جرح' : 'Scrape / Cut',
      description: isArabic
        ? 'تعرضت الطالبة لكشط في الركبة أثناء اللعب في الساحة الخارجية، ولم تكن هناك أعراض أخرى.'
        : 'Grazed a knee while playing in the outdoor yard. No other symptoms observed.',
      actionsTaken: isArabic
        ? 'تم تنظيف الجرح بمحلول مطهر ووضع ضمادة، وتمت مراقبة الطالبة لمدة ثلاثين دقيقة.'
        : 'Cleaned the graze with antiseptic, applied a dressing and monitored for thirty minutes.',
      recommendedFollowUp: isArabic ? 'تغيير الضمادة غدًا صباحًا.' : 'Change the dressing tomorrow morning.',
      reportedByName: isArabic ? 'الممرضة أميرة' : 'Nurse Amira',
      parentContacted: true,
      parentContactTime: '7:30AM',
    },
  }, overrides);
}

export function invoiceFixture(locale: ReportLocale = 'en', overrides: Overrides = {}) {
  const isArabic = locale === 'ar';

  return merge({
    meta: meta(locale),
    center: isArabic ? arabicCenter : center,
    settings: { ...bannerSettings },
    invoice: {
      invoiceNumber: 1042,
      issueDate: '01/09/2026',
      academicYearTitle: '2026/2027',
      studentId: 55,
      studentName: isArabic ? 'يارا حسن محمد' : 'Yara Hassan Mohamed',
      parentName: isArabic ? 'حسن محمد علي' : 'Hassan Mohamed Ali',
      className: 'KG1-A',
      feeLines: [
        { title: isArabic ? 'رسوم دراسية' : 'Tuition fees', amount: '10,000.00' },
        { title: isArabic ? 'رسوم الحافلة' : 'Bus fees', amount: '2,000.00' },
        { title: isArabic ? 'الزي المدرسي' : 'Uniform', amount: '500.00' },
      ],
      discount: { description: isArabic ? 'خصم الأخوة' : 'Sibling discount', amount: '(1,000.00)' },
      vatAmount: '1,610.00',
      total: '13,110.00',
      currencyCode: 'EGP',
      totalInWords: isArabic
        ? 'ثلاثة عشر ألفًا ومائة وعشرة جنيهات مصرية فقط'
        : 'Thirteen Thousand One Hundred Ten EGP Only',
    },
  }, overrides);
}

export function receiptFixture(locale: ReportLocale = 'en', overrides: Overrides = {}) {
  const isArabic = locale === 'ar';

  return merge({
    meta: meta(locale),
    center: isArabic ? arabicCenter : center,
    settings: { ...bannerSettings, reportSize: 'A4' as const },
    receipt: {
      receiptNumber: 7781,
      date: '01/09/2026',
      parentName: isArabic ? 'حسن محمد علي' : 'Hassan Mohamed Ali',
      studentName: isArabic ? 'يارا حسن محمد' : 'Yara Hassan Mohamed',
      invoiceNumber: 1042,
      description: isArabic ? 'القسط الأول' : 'Installment 1 of 4',
      amount: '3,277.50',
      currencyCode: 'EGP',
      amountInWords: isArabic
        ? 'ثلاثة آلاف ومائتان وسبعة وسبعون جنيهًا وخمسون قرشًا فقط'
        : 'Three Thousand Two Hundred Seventy Seven EGP and Fifty Piastres Only',
      paymentTypeTitle: isArabic ? 'نقدًا' : 'Cash',
      paymentNote: isArabic ? 'تم الاستلام في المكتب.' : 'Received at the front office.',
    },
  }, overrides);
}

export function evaluationFixture(locale: ReportLocale = 'en', overrides: Overrides = {}) {
  const isArabic = locale === 'ar';

  /** Two full branches so the recursive node partial and page breaking both get exercised. */
  const nodes = Array.from({ length: 6 }, (_, group) => ({
    id: 100 + group,
    title: isArabic ? `المجال ${group + 1}` : `Developmental Area ${group + 1}`,
    level: 1,
    remark: group === 0 ? (isArabic ? 'تقدم ملحوظ هذا الفصل.' : 'Noticeable progress this term.') : null,
    children: Array.from({ length: 3 }, (_, category) => ({
      id: 200 + group * 10 + category,
      title: isArabic ? `الفئة ${category + 1}` : `Category ${category + 1}`,
      level: 2,
      children: Array.from({ length: 4 }, (_, item) => ({
        id: 300 + group * 100 + category * 10 + item,
        title: isArabic
          ? `يستطيع الطالب أداء المهارة رقم ${item + 1} بشكل مستقل`
          : `Can perform skill number ${item + 1} independently`,
        level: 3,
        values: [{ value: 'A' }, { value: 'B' }],
        children: [],
      })),
    })),
  }));

  return merge({
    meta: meta(locale),
    childInfo: {
      name: isArabic ? 'يارا حسن محمد' : 'Yara Hassan Mohamed',
      class: 'KG1-A',
      teacher: isArabic ? 'أميرة سعيد، منى فؤاد' : 'Amira Said, Mona Fouad',
      age: isArabic ? '٤ سنوات' : '4 years',
      attendance: '150/180',
      dateFrom: '01/09/2025',
      dateTo: '30/06/2026',
    },
    settings: {
      ...bannerSettings,
      headerImageUrl: 'header.png',
      footerImageUrl: 'footer.png',
      showAge: true,
      showAttendance: true,
      showTeacher: true,
    },
    variants: {
      title_background_color: '#1f4e79',
      title_text_color: '#ffffff',
      subtitle1_background_color: '#deebf7',
      subtitle1_text_color: '#1f4e79',
      subtitle2_background_color: '#f2f2f2',
      subtitle2_text_color: '#333333',
      show_age: true,
      show_attendance: true,
      show_teacher: true,
    },
    terms: [
      { title: isArabic ? 'الفصل الأول' : 'Term 1' },
      { title: isArabic ? 'الفصل الثاني' : 'Term 2' },
    ],
    nodes,
    legend: [
      { value: 'A', text: isArabic ? 'ممتاز' : 'Excellent' },
      { value: 'B', text: isArabic ? 'جيد' : 'Good' },
      { value: 'C', text: isArabic ? 'يحتاج إلى تدريب' : 'Needs practice' },
    ],
    globalRemark: isArabic
      ? 'أظهرت يارا تقدمًا جيدًا في جميع المجالات، ونوصي بمواصلة القراءة في المنزل.'
      : 'Yara has progressed well across all areas. We recommend continued reading at home.',
  }, overrides);
}

export const FIXTURES = {
  evaluation: evaluationFixture,
  incident: incidentFixture,
  invoice: invoiceFixture,
  receipt: receiptFixture,
} as const;
