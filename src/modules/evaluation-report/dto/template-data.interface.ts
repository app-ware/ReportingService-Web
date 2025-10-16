import { EvaluationReportPrintingVariants } from "./report-data.interface";

export interface TemplateData {
  childInfo: ChildInfo;
  settings: ReportSettings;
  variants: EvaluationReportPrintingVariants;  
  terms: TermHeader[];
  nodes: ReportNode[];
  legend: LegendItem[];
  globalRemark?: string|null;
}

export interface ChildInfo {
  name: string;
  class: string;
  teacher: string;
  age: string;
  attendance: string;
  dateFrom: string;
  dateTo: string;
}

export interface ReportSettings {
  useImages: boolean;
  includeFooter: boolean;
  headerImageUrl?: string;
  footerImageUrl?: string;
  showAge: boolean;
  showAttendance: boolean;
  showTeacher: boolean;
}

export interface TermHeader {
  title: string;
}

export interface ReportNode {
  id: number;
  title: string;
  level: number;
  values?: { value: string | null }[];
  remark?: string;
  children: ReportNode[];
}

export interface LegendItem {
  value: string;
  text: string;
}

export interface ReportDate {
  
  settings?: {
    footerImageBase64?: string | null;
    includeFooter?: boolean;
    useImages?: boolean;
    headerImageBase64?: string | null;
}