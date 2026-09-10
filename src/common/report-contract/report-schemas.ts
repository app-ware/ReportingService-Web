import { ObjectSpec, arr, bool, image, num, obj, str } from './field-spec';

/**
 * Version-1 payload shapes for the four report flows.
 *
 * These mirror the `dto/template-data.interface.ts` of each module — the interfaces stay
 * the compile-time contract, these specs are the runtime one. Sizes are generous enough
 * for real data (long Arabic student names, multi-paragraph incident descriptions) while
 * still bounding what reaches Chromium.
 */

/** Text that lands in a table cell or heading. */
const SHORT_TEXT = 512;
/** Free-text a nurse or teacher typed. */
const LONG_TEXT = 8_000;

const centerSpec = obj(
  {
    name: str({ required: true, maxLength: SHORT_TEXT }),
    address: str({ nullable: true, maxLength: SHORT_TEXT }),
    landLine: str({ nullable: true, maxLength: 64 }),
    logoBase64: image({ nullable: true }),
  },
  { required: true },
);

const bannerSettings = {
  useImages: bool({ required: true }),
  includeFooter: bool({ required: true }),
  headerImageBase64: image({ nullable: true }),
  footerImageBase64: image({ nullable: true }),
};

// ---------------------------------------------------------------------------
// Incident
// ---------------------------------------------------------------------------

export const incidentReportSchema: ObjectSpec = obj({
  center: centerSpec,
  settings: obj(bannerSettings, { required: true }),
  student: obj({ name: str({ required: true, maxLength: SHORT_TEXT }) }, { required: true }),
  incident: obj(
    {
      date: str({ required: true, maxLength: 64 }),
      time: str({ required: true, maxLength: 64 }),
      title: str({ required: true, maxLength: SHORT_TEXT }),
      description: str({ required: true, maxLength: LONG_TEXT }),
      actionsTaken: str({ required: true, maxLength: LONG_TEXT }),
      recommendedFollowUp: str({ nullable: true, maxLength: LONG_TEXT }),
      reportedByName: str({ nullable: true, maxLength: SHORT_TEXT }),
      parentContacted: bool({ required: true }),
      parentContactTime: str({ nullable: true, maxLength: 64 }),
    },
    { required: true },
  ),
});

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export const invoiceReportSchema: ObjectSpec = obj({
  center: centerSpec,
  settings: obj(bannerSettings, { required: true }),
  invoice: obj(
    {
      invoiceNumber: num({ nullable: true, integer: true, min: 0 }),
      issueDate: str({ required: true, maxLength: 64 }),
      academicYearTitle: str({ nullable: true, maxLength: SHORT_TEXT }),
      studentId: num({ required: true, integer: true, min: 0 }),
      studentName: str({ required: true, maxLength: SHORT_TEXT }),
      parentName: str({ nullable: true, maxLength: SHORT_TEXT }),
      className: str({ nullable: true, maxLength: SHORT_TEXT }),
      feeLines: arr(
        obj({
          title: str({ required: true, maxLength: SHORT_TEXT }),
          amount: str({ required: true, maxLength: 64 }),
        }),
        200,
        { required: true },
      ),
      discount: obj(
        {
          description: str({ required: true, maxLength: SHORT_TEXT }),
          amount: str({ required: true, maxLength: 64 }),
        },
        { nullable: true },
      ),
      // Amounts arrive as already-formatted strings: Nursery owns the calculation and
      // the display formatting for invoices, and the renderer must not reinterpret them.
      vatAmount: str({ required: true, maxLength: 64 }),
      total: str({ required: true, maxLength: 64 }),
      currencyCode: str({ required: true, maxLength: 16 }),
      totalInWords: str({ required: true, maxLength: 1_000 }),
    },
    { required: true },
  ),
});

// ---------------------------------------------------------------------------
// Receipt
// ---------------------------------------------------------------------------

export const receiptReportSchema: ObjectSpec = obj({
  center: centerSpec,
  settings: obj(
    {
      ...bannerSettings,
      reportSize: str({ required: true, enum: ['A4', 'A5'] }),
    },
    { required: true },
  ),
  receipt: obj(
    {
      receiptNumber: num({ nullable: true, integer: true, min: 0 }),
      date: str({ required: true, maxLength: 64 }),
      parentName: str({ nullable: true, maxLength: SHORT_TEXT }),
      studentName: str({ required: true, maxLength: SHORT_TEXT }),
      invoiceNumber: num({ nullable: true, integer: true, min: 0 }),
      description: str({ required: true, maxLength: SHORT_TEXT }),
      amount: str({ required: true, maxLength: 64 }),
      currencyCode: str({ required: true, maxLength: 16 }),
      amountInWords: str({ required: true, maxLength: 1_000 }),
      paymentTypeTitle: str({ nullable: true, maxLength: SHORT_TEXT }),
      paymentNote: str({ nullable: true, maxLength: LONG_TEXT }),
    },
    { required: true },
  ),
});

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * The evaluation node tree is recursive and its depth is bounded by the four
 * group levels the source stored procedure emits.
 */
const evaluationNodeSpec: ObjectSpec = obj({
  id: num({ required: true, integer: true }),
  title: str({ nullable: true, maxLength: SHORT_TEXT }),
  level: num({ required: true, integer: true, min: 1, max: 4 }),
  remark: str({ nullable: true, maxLength: LONG_TEXT }),
  values: arr(obj({ value: str({ nullable: true, maxLength: 64 }) }), 8, { nullable: true }),
  children: arr(() => evaluationNodeSpec, 500, { nullable: true }),
});

/**
 * `variants` is a per-report configuration row: the label text and the palette the
 * center chose for this evaluation form. It is enumerated rather than passed through
 * because every one of these values is interpolated into an inline `style` attribute
 * or a heading in the template — an open-ended object there is an injection surface.
 * Labels that Nursery does not supply fall back to the renderer's localized defaults.
 */
const evaluationVariantsSpec: ObjectSpec = obj(
  {
    title_background_color: str({ nullable: true, maxLength: 64 }),
    title_text_color: str({ nullable: true, maxLength: 64 }),
    subtitle1_background_color: str({ nullable: true, maxLength: 64 }),
    subtitle1_text_color: str({ nullable: true, maxLength: 64 }),
    subtitle2_background_color: str({ nullable: true, maxLength: 64 }),
    subtitle2_text_color: str({ nullable: true, maxLength: 64 }),
    label_student_name: str({ nullable: true, maxLength: SHORT_TEXT }),
    label_class: str({ nullable: true, maxLength: SHORT_TEXT }),
    label_age: str({ nullable: true, maxLength: SHORT_TEXT }),
    label_from: str({ nullable: true, maxLength: SHORT_TEXT }),
    label_to: str({ nullable: true, maxLength: SHORT_TEXT }),
    label_attendance: str({ nullable: true, maxLength: SHORT_TEXT }),
    label_teacher: str({ nullable: true, maxLength: SHORT_TEXT }),
    label_legend: str({ nullable: true, maxLength: SHORT_TEXT }),
    label_remark_global: str({ nullable: true, maxLength: SHORT_TEXT }),
    label_remark_node: str({ nullable: true, maxLength: SHORT_TEXT }),
    show_age: bool({ nullable: true }),
    show_attendance: bool({ nullable: true }),
    show_teacher: bool({ nullable: true }),
  },
  { nullable: true },
);

export const evaluationReportSchema: ObjectSpec = obj({
  childInfo: obj(
    {
      name: str({ required: true, maxLength: SHORT_TEXT }),
      class: str({ nullable: true, maxLength: SHORT_TEXT }),
      teacher: str({ nullable: true, maxLength: LONG_TEXT }),
      age: str({ nullable: true, maxLength: 64 }),
      attendance: str({ nullable: true, maxLength: 64 }),
      dateFrom: str({ nullable: true, maxLength: 64 }),
      dateTo: str({ nullable: true, maxLength: 64 }),
    },
    { required: true },
  ),
  settings: obj(
    {
      useImages: bool({ required: true }),
      includeFooter: bool({ required: true }),
      headerImageBase64: image({ nullable: true }),
      footerImageBase64: image({ nullable: true }),
      // Retained for compatibility with the current Nursery payload; the renderer never
      // dereferences these, it only ever renders the base64 variants above.
      headerImageUrl: str({ nullable: true, maxLength: 2_048 }),
      footerImageUrl: str({ nullable: true, maxLength: 2_048 }),
      showAge: bool({ nullable: true }),
      showAttendance: bool({ nullable: true }),
      showTeacher: bool({ nullable: true }),
    },
    { required: true },
  ),
  variants: evaluationVariantsSpec,
  terms: arr(obj({ title: str({ nullable: true, maxLength: SHORT_TEXT }) }), 8, { required: true }),
  nodes: arr(evaluationNodeSpec, 2_000, { required: true }),
  legend: arr(
    obj({
      value: str({ nullable: true, maxLength: 64 }),
      text: str({ nullable: true, maxLength: SHORT_TEXT }),
    }),
    50,
    { nullable: true },
  ),
  globalRemark: str({ nullable: true, maxLength: LONG_TEXT }),
});

export type ReportType = 'evaluation' | 'incident' | 'invoice' | 'receipt';

export const REPORT_SCHEMAS: Readonly<Record<ReportType, ObjectSpec>> = {
  evaluation: evaluationReportSchema,
  incident: incidentReportSchema,
  invoice: invoiceReportSchema,
  receipt: receiptReportSchema,
};
