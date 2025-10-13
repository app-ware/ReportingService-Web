import { Module } from '@nestjs/common';
import { ReportingController } from './evaluation-reports.controller';
import { PdfService } from './pdf.service';

@Module({
  controllers: [ReportingController],
  providers: [PdfService],
})
export class EvaluationReportsModule {}