import { Module } from '@nestjs/common';
import { ReceiptReportsController } from './receipt-reports.controller';
import { ReceiptReportsService } from './receipt-reports.service';
import { ReceiptReportPdfService } from './pdf.service';

@Module({
  controllers: [ReceiptReportsController],
  providers: [ReceiptReportsService, ReceiptReportPdfService],
})
export class ReceiptReportsModule {}
