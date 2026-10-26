export interface PaySlipReportTemplateData {
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
  paySlip: {
    employeeName: string;
    employeeTitle: string | null;
    incomeMonth: string;
    receiveDate: string;
    currencyCode: string;
    salary: string;
    benefits: Array<{ title: string; amount: string }>;
    deductions: Array<{ title: string; amount: string }>;
    totalEarnings: string;
    totalDeductions: string;
    netIncome: string;
    netIncomeInWords: string;
  };
}
