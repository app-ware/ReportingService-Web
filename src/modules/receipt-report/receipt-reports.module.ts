import { Module } from '@nestjs/common';
import { ReceiptReportsController } from './receipt-reports.controller';
import { ReceiptReportsService } from './receipt-reports.service';

/** Rendering infrastructure comes from the global `RenderModule` — see IncidentReportsModule. */
@Module({
  controllers: [ReceiptReportsController],
  providers: [ReceiptReportsService],
})
export class ReceiptReportsModule {}
