export interface PrintableReportSettings {
  printable_report_settings_id?: number;
  center_id?: number;
  printable_report_type?: number;
  header_image_url: string;
  footer_image_url: string;
  header_image: string;
  footer_image: string;
  use_images?: boolean;
  include_footer?: boolean;
}

export interface EvaluationReportLegend {
  evaluation_report_legend_id: number;
  evaluation_report_id: number;
  evaluation_report_legend_text: string;
  evaluation_report_legend_value: string;
}

 
export interface EvaluationReportPrintingVariants {
  show_attendance: boolean;
  show_term: boolean;  
  show_age: boolean;
  show_teacher: boolean;
  label_age: string;
  label_to: string;
  label_from: string;
  label_class: string;
  label_remark_global: string;
  label_remark_node: string;
  label_legend: string;
  label_year: string;
  label_month: string;
  label_day: string;
  label_attendance: string;
  label_student_name: string;
  label_teacher: string;
  title_text_color: string;
  title_background_color: string;
  subtitle1_text_color: string;
  subtitle1_background_color: string;
  subtitle2_text_color: string;
  subtitle2_background_color: string;
  term_title_text_color: string;
  term_title_background_color: string;
}
