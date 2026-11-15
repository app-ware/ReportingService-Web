export interface ReceiptReportTemplateData {
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
    reportSize: 'A4' | 'A5';
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
  receipt: {
    receiptNumber: number | null;
    date: string;
    parentName: string | null;
    studentName: string;
    invoiceNumber: number | null;
    description: string;
    amount: string;
    currencyCode: string;
    amountInWords: string;
    paymentTypeTitle: string | null;
    paymentNote: string | null;
  };
}
