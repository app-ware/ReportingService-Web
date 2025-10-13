// //#region Existed Service 
// import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as mssql from 'mssql';
// import * as fs from 'fs/promises';
// import * as path from 'path';
// import { ICARE_MSSQL_POOL } from 'src/config/mssql/mssql-client.constants';
// import { GenerateEvaluationReportDto } from './dto/evaluation-report.dto';
// import { PdfService } from './pdf.service';
// import { PrintableReportSettings, EvaluationReportLegend, EvaluationReportPrintingVariants } from './dto/report-data.interface';
// import { TemplateData, ReportNode, ChildInfo, ReportSettings, LegendItem, TermHeader } from './dto/template-data.interface';
// import { lookup } from 'mime-types';


// @Injectable()
// export class EvaluationReportsService {
//     constructor(
//         @Inject(ICARE_MSSQL_POOL) private readonly icarePool: mssql.ConnectionPool,
//         private readonly pdfService: PdfService,
//         private readonly configService: ConfigService,
//     ) { }


//     async generateReport(centerId: number, dto: GenerateEvaluationReportDto): Promise<Buffer> {

//         try {
//             const [
//                 childData,
//                 reportSPData,
//                 extraData,
//                 variants,
//                 legendData,
//                 printableSettings,
//             ] = await Promise.all([
//                 this.getChildById(dto.childId),
//                 this.getTermEvaluationData(dto.childId, dto.reportId, dto.terms),
//                 this.getReportExtraData(dto.childId, dto.reportId, dto.terms),
//                 this.getReportVariants(dto.reportId),
//                 this.getReportLegend(dto.reportId),
//                 this.getPrintableReportSettings(centerId),
//             ]);

//             if (!childData) {
//                 throw new NotFoundException(`Child with ID ${dto.childId} not found.`);
//             }

//             const [headerImageBase64, footerImageBase64] = await Promise.all([
//                 this.getImageAsBase64(centerId, printableSettings?.header_image || null),
//                 this.getImageAsBase64(centerId, printableSettings?.footer_image || null)
//             ]);

//             const templateData: TemplateData = this._buildTemplateData({
//                 childData, reportSPData, extraData, variants, legendData, printableSettings, headerImageBase64, footerImageBase64
//             });

//             const pdfBuffer = await this.pdfService.generatePdfFromTemplate(
//                 // 'evaluation-report.hbs',
//                 templateData
//             );

//             await this.saveAndApproveReport(centerId, pdfBuffer, dto);

//             console.log("headerImageBase64", headerImageBase64)
//             return pdfBuffer;

//         } catch (error) {
//             console.error('Failed to generate report:', error);
//             throw new InternalServerErrorException('An error occurred while generating the report.');
//         }
//     }

//     private async getChildById(childId: number): Promise<any> {
//         const result = await this.icarePool.request()
//             .input('child_id', mssql.Int, childId)
//             .execute('getChildByID');
//         return result.recordset[0];
//     }

//     private async getTermEvaluationData(childId: number, reportId: number, terms: string): Promise<any[]> {
//         const result = await this.icarePool.request()
//             .input('child_id', mssql.Int, childId)
//             .input('evaluation_report_id', mssql.Int, reportId)
//             .input('evaluation_terms', mssql.NVarChar(mssql.MAX), terms)
//             .execute('getTermEvaluationReportDataByChild');
//         // console.log("Remarks",result.recordset)
//         return result.recordset;
//     }

//     private async getReportExtraData(childId: number, reportId: number, terms: string): Promise<any> {
//         const result = await this.icarePool.request()
//             .input('child_id', mssql.Int, childId)
//             .input('evaluation_report_id', mssql.Int, reportId)
//             .input('evaluation_terms', mssql.VarChar(mssql.MAX), terms)
//             .execute('iCareWebPanel_getChildEvaluationReportExtraData');
//         console.log(" result.recordset 1 ", result.recordset)
//         return result.recordset[0];
//     }

//     private async getReportVariants(reportId: number): Promise<any> {
//         const result = await this.icarePool.request()
//             .input('evaluation_report_id', mssql.Int, reportId)
//             .execute('iCareWebPanel_getEvaluationReportFormVariants');
//         console.log(" result.recordset 11 ", result.recordset[0])
//         return result.recordset[0];
//     }

//     private async getReportLegend(reportId: number): Promise<EvaluationReportLegend[]> {
//         const result = await this.icarePool.request()
//             .input('evaluation_report_id', mssql.Int, reportId)
//             .query('SELECT * FROM Evaluation_Report_Legend WHERE evaluation_report_id = @evaluation_report_id ORDER BY evaluation_report_legend_id');

//         console.log(" result.recordset 2 ", result.recordset)
//         return result.recordset;

//     }

//     private transformReportData(spData: any[]): { nodes: ReportNode[], terms: TermHeader[], globalRemark: string | null } {
//         if (!spData || spData.length === 0) {
//             return { nodes: [], terms: [], globalRemark: null };
//         }

//         const nodes: ReportNode[] = [];
//         const groupMap = new Map<number, ReportNode>();

//         const terms = [
//             { title: spData[0].term1_title },
//             { title: spData[0].term2_title },
//             { title: spData[0].term3_title },
//             { title: spData[0].term4_title },
//         ].filter(th => th.title && th.title.trim() !== '');

//         // const report_remark = spData[0]?.report_remark;

//         for (const row of spData) {
//             let parentNode: ReportNode | null = null;

//             for (let i = 1; i <= 4; i++) {
//                 const id = row[`group${i}_id`];
//                 if (!id) break;

//                 let node = groupMap.get(id)
//                 if (!node) {
//                     const isItem = (i === 4 || !row[`group${i + 1}_id`]); // It's an item if it's level 4 or the last level in the row
//                     node = {
//                         id: id,
//                         title: isItem ? row.term_item_text : row[`group${i}_title`],
//                         level: i,
//                         children: [],
//                         remark: row.node_remark,
//                         values: isItem ? terms.map((t, index) => ({ value: row[`term${index + 1}_item_value`] })) : undefined

//                     }
//                     groupMap.set(id, node);

//                     if (parentNode) {
//                         parentNode.children.push(node);
//                     } else {
//                         nodes.push(node);
//                     }
//                 }
//                 parentNode = node;
//             }

//         }
//         console.log("reportData ", nodes)
//         console.log("termHeaders", terms)
//         console.log("report_remark", spData[0]?.report_remark)

//         return { nodes, terms, globalRemark: spData[0]?.report_remark };
//     }

//     private async saveAndApproveReport(centerId: number, pdfBuffer: Buffer, dto: GenerateEvaluationReportDto): Promise<string> {
//         const reportFolder = path.resolve(process.cwd(), `src/assets/reports`);
//         const fname = Math.round((new Date().getTime() - new Date('2012-01-01').getTime()) / 1000);
//         const filename = `${dto.childId}_${fname}_EvaluationReport.pdf`;

//         if (!reportFolder) {
//             throw new InternalServerErrorException('PHOTO_FOLDER environment variable is not set.');
//         }
//         const reportPath = path.join(reportFolder, centerId.toString(), 'EvaluationReport');
//         await fs.mkdir(reportPath, { recursive: true });

//         const fullPath = path.join(reportPath, filename);
//         await fs.writeFile(fullPath, pdfBuffer);

//         if (dto.approve) {
//             const request = this.icarePool.request();
//             await request
//                 .input('child_id', mssql.Int, dto.childId)
//                 .input('evaluation_report_id', mssql.Int, dto.reportId)
//                 .input('evaluation_terms_id', mssql.NVarChar(mssql.MAX), dto.terms)
//                 .input('is_approved', mssql.Bit, 1)
//                 .input('filename', mssql.NVarChar, filename)
//                 .query(`
//                 IF NOT EXISTS (SELECT 1 FROM [Evaluation_Report_Child_File_Link] WHERE child_id = @child_id AND evaluation_report_id = @evaluation_report_id)
//                 BEGIN
//                     INSERT INTO Evaluation_Report_Child_File_Link(child_id, evaluation_report_id, evaluation_terms_id, is_approved, [file_link_name])
//                     VALUES(@child_id, @evaluation_report_id, @evaluation_terms_id, @is_approved, @filename);
//                 END
//                 ELSE
//                 BEGIN
//                     UPDATE Evaluation_Report_Child_File_Link
//                     SET [file_link_name] = @filename, is_approved = @is_approved, evaluation_terms_id = @evaluation_terms_id
//                     WHERE child_id = @child_id AND evaluation_report_id = @evaluation_report_id;
//                 END
//             `);
//             // [TODO] trigger a notification service.
//         }
//         console.log("file name", filename)
//         return filename;
//     }

//     private _buildTemplateData(dataSources: any): any {
//         // const { childData, extraData, variants, legendData, printableSettings, reportData, termHeaders, report_remark } = dataSources;
//         const { childData, reportSPData, extraData, variants, legendData, printableSettings, headerImageBase64, footerImageBase64 } = dataSources;
//         // console.log("dataSource:",dataSources)
//         const safeVariants = variants;


//         const childInfo: ChildInfo = {
//             name: childData.child_name,
//             class: childData.class_name,
//             attendance: `${extraData.child_attendance_days}/${extraData.center_active_days}`,
//             teacher: extraData.teachers,
//             dateFrom: new Date(extraData.start_date).toLocaleDateString(),
//             dateTo: new Date(extraData.end_date).toLocaleDateString(),
//             age: childData.child_dob ? `${new Date().getFullYear() - new Date(childData.child_dob).getFullYear()} years` : 'N/A',
//         };

//         // 2. Create the 'settings' object by combining two sources
//         const settings = {
//             useImages: printableSettings?.use_images === true,
//             includeFooter: printableSettings?.include_footer === true,
//             headerImageBase64: headerImageBase64,
//             footerImageBase64: footerImageBase64,

//             // useImages: printableSettings?.use_images ?? false,
//             headerImageUrl: printableSettings?.header_image ?? '',
//             footerImageUrl: printableSettings?.footer_image ?? '',
//             // includeFooter: printableSettings?.include_footer ?? true,
//             showAge: variants?.show_age ?? true,
//             showAttendance: variants?.show_attendance ?? true,
//             showTeacher: variants?.show_teacher ?? true,
//         };

//         // 3. Map the legend data to have 'text' and 'value' properties
//         const legend: LegendItem = legendData.map(item => ({
//             text: item.evaluation_report_legend_text,
//             value: item.evaluation_report_legend_value,
//         }));

//         // 4. Assemble the final object with names matching the template

//         const { nodes, terms, globalRemark } = this.transformReportData(reportSPData);

//         const finalTemplateData = {
//             childInfo,
//             settings,
//             legend,
//             variants,
//             nodes,
//             terms,
//             globalRemark
//         };
//         // console.log('Child info', childInfo)
//         console.log('settings', settings)
//         // console.log('legend', legend)
//         // console.log('terms', terms)
//         // console.log('finalTemplateData', finalTemplateData)
//         // console.log('globalRemark', globalRemark)


//         return finalTemplateData;
//     }

//     private async getPrintableReportSettings(centerId: number): Promise<PrintableReportSettings | null> {
//         const reportTypeEvaluation = 6;
//         const result = await this.icarePool.request()
//             .input('center_id', mssql.Int, centerId)
//             .input('printable_report_type', mssql.Int, reportTypeEvaluation)
//             .query(`
//                 SELECT TOP 1 * FROM Center_Printable_Report_Settings 
//                 WHERE center_id = @center_id AND printable_report_type = @printable_report_type
//             `);
//         return result.recordset[0] ?? null;
//     }

//     private async getImageAsBase64(centerId: number, filename: string | null): Promise<string | null> {
//         if (!filename) {
//             return null;
//         }

//         const photoFolder = this.configService.get<string>('PHOTO_FOLDER');
//         if (!photoFolder) {
//             console.error('PHOTO_FOLDER environment variable is not set.');
//             return null;
//         }

//         const fullPath = path.join(photoFolder, centerId.toString(), 'PrintableReport', filename);

//         try {
//             const fileBuffer = await fs.readFile(fullPath);
//             const mimeType = lookup(filename) || 'application/octet-stream';
//             return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
//         } catch (error) {
//             console.error(`Could not read image file at ${fullPath}:`, error);
//             return null; 
//         }
//     }

// }


// //#endregion



import { Injectable } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { TemplateData } from './dto/template-data.interface'; 

@Injectable()
export class EvaluationReportsService {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * Takes the final, complete template data and passes it to the PdfService
   * to generate the PDF buffer.
   * @param templateData The fully assembled data object from the main API.
   * @returns A Promise resolving to the PDF file buffer.
   */
  async createPdfFromData(templateData: TemplateData): Promise<Buffer> {
    // The only responsibility of this service is to call the PdfService.
    return this.pdfService.generatePdfFromTemplate(templateData);
  }
}