/**
 * Payload for one installment slip. Nursery formats every value (dates, amount, amount in
 * words); `status` is a value the template turns into a localized label. See `../.md` §4.
 */
export interface InstallmentReportTemplateData {
  settings: {
    /** Invoice (type 1) `use_images`: the slip uses the Invoice printable settings. */
    useImages: boolean;
    /** `use_images && include_footer`, the same rule as the invoice. */
    includeFooter: boolean;
    headerImageBase64: string | null;
    footerImageBase64: string | null;
  };
  installment: {
    parentName: string | null;
    spouseName: string | null;
    studentName: string;
    studentId: number;
    className: string | null;
    /** The center's active academic year, as legacy prints it. */
    academicYearTitle: string | null;
    /** dd/MM/yyyy */
    dueDate: string;
    /** dd/MM/yyyy, the invoice date */
    issueDate: string;
    /** Pre-formatted, e.g. "2,532.00" */
    amount: string;
    currencyCode: string;
    amountInWords: string;
    status: 'paid' | 'pending' | 'cancelled';
    /** 1-based position among the invoice's non-deleted installments, by id. */
    number: number;
    count: number;
  };
}
