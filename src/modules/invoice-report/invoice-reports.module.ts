import { Module } from '@nestjs/common';
import { InvoiceReportsController } from './invoice-reports.controller';
import { InvoiceReportsService } from './invoice-reports.service';
import { InvoiceReportPdfService } from './pdf.service';

@Module({
  controllers: [InvoiceReportsController],
  providers: [InvoiceReportsService, InvoiceReportPdfService],
})
export class InvoiceReportsModule {}
