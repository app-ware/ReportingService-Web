export interface IncidentReportTemplateData {
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
  student: {
    name: string;
  };
  incident: {
    date: string;
    time: string;
    title: string;
    description: string;
    actionsTaken: string;
    recommendedFollowUp: string | null;
    reportedByName: string | null;
    parentContacted: boolean;
    parentContactTime: string | null;
  };
}
