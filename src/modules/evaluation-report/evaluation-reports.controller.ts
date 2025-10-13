// import {
//   Controller,
//   HttpCode,
//   HttpStatus,
//   Res,
//   UseGuards,
//   ParseIntPipe,
//   ValidationPipe,
//   Query,
//   Get,
// } from '@nestjs/common';
// import type { Response } from 'express';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { CenterAccessGuard } from 'src/common/guards/center-access.guard';
// import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
// import { User } from 'src/common/decorators/user.decorator';
// import { EvaluationReportsService } from './evaluation-reports.service';
// import { GenerateEvaluationReportDto } from './dto/evaluation-report.dto';

// @Controller('evaluation-reports')
// export class EvaluationReportsController {
//   constructor(
//     private readonly evaluationReportsService: EvaluationReportsService,
//   ) {}

//   @ResponseMessage('Successfully generated evaluation report.')
//   @UseGuards(JwtAuthGuard, CenterAccessGuard)
//   @Get('child')  
//   @HttpCode(HttpStatus.OK)
//   async generateReport(
//     @User('centerId', ParseIntPipe) centerId: number,
//     @Query(new ValidationPipe()) reportDto: GenerateEvaluationReportDto,
//     @Res() res: Response,
//   ): Promise<void> {

//      const pdfBuffer = await this.evaluationReportsService.generateReport(
//       centerId,
//       reportDto,
//     );
    
//     const fileName = `evaluation_report_${reportDto.childId}.pdf`;
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader(
//       'Content-Disposition',
//       `inline; filename=${fileName}`,  
//     );
//     res.send(pdfBuffer);
//   }
// }


import { Controller, Post, Body, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';

@Controller('reports')
export class ReportingController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('evaluation')
  @Header('Content-Type', 'application/pdf')
  async createEvaluationReport(@Body() templateData: any, @Res() res: Response) {
    const pdfBuffer = await this.pdfService.generatePdfFromTemplate(templateData);
    res.send(pdfBuffer);
    
  }
}