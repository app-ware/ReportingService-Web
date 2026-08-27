import { Module } from '@nestjs/common';
import { IncidentReportsController } from './incident-reports.controller';
import { IncidentReportsService } from './incident-reports.service';
import { IncidentReportPdfService } from './pdf.service';

@Module({
  controllers: [IncidentReportsController],
  providers: [IncidentReportsService, IncidentReportPdfService],
})
export class IncidentReportsModule {}
