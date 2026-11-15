export interface InvoiceReportTemplateData {
  center: {
    name: string;
    address: string | null;
    landLine: string | null;
    logoBase64: string | null;
  };
  settings: {
    useImages: boolean;
    includeFooter: boolean;
    headerImageBase64: string | null;
    footerImageBase64: string | null;
    /** Shared receipt/invoice report variants; optional for older version-1 callers. */
    fineprintMessage?: string | null;
    fineprintVisible?: boolean | null;
    footerMessage?: string | null;
    footerVisible?: boolean | null;
    signatures?: Array<{
      slot?: number | null;
      visible?: boolean | null;
      note?: string | null;
    }> | null;
  };
  invoice: {
    invoiceNumber: number | null;
    issueDate: string;
    academicYearTitle: string | null;
    studentId: number;
    studentName: string;
    parentName: string | null;
    className: string | null;
    feeLines: Array<{ title: string; amount: string }>;
    discount: { description: string; amount: string } | null;
    vatAmount: string;
    total: string;
    currencyCode: string;
    totalInWords: string;
  };
}
