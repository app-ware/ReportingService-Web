import { EvaluationReportPrintingVariants } from './report-data.interface';

export interface TemplateData {
  childInfo: ChildInfo;
  settings: ReportSettings;
  variants?: EvaluationReportPrintingVariants | null;
  terms: TermHeader[];
  nodes: ReportNode[];
  legend?: LegendItem[] | null;
  globalRemark?: string | null;
}

export interface ChildInfo {
  name: string;
  class?: string | null;
  teacher?: string | null;
  age?: string | null;
  attendance?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface ReportSettings {
  useImages: boolean;
  includeFooter: boolean;
  /** Base64 image data URI — the only form the renderer will draw. */
  headerImageBase64?: string | null;
  footerImageBase64?: string | null;
  /**
   * Retained because the current Nursery payload still sends them, but never
   * dereferenced: the renderer blocks `http:`/`https:`/`file:` requests, so an image can
   * only ever reach a page as inline base64.
   */
  headerImageUrl?: string | null;
  footerImageUrl?: string | null;
  showAge?: boolean | null;
  showAttendance?: boolean | null;
  showTeacher?: boolean | null;
}

export interface TermHeader {
  title?: string | null;
}

export interface ReportNode {
  id: number;
  title?: string | null;
  level: number;
  values?: { value: string | null }[] | null;
  remark?: string | null;
  children?: ReportNode[] | null;
}

export interface LegendItem {
  value?: string | null;
  text?: string | null;
}
