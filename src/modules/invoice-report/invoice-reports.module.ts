import { Module } from '@nestjs/common';
import { InvoiceReportsController } from './invoice-reports.controller';
import { InvoiceReportsService } from './invoice-reports.service';

/** Rendering infrastructure comes from the global `RenderModule` — see IncidentReportsModule. */
@Module({
  controllers: [InvoiceReportsController],
  providers: [InvoiceReportsService],
})
export class InvoiceReportsModule {}
