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
