import { Module } from '@nestjs/common';
import { PaySlipReportsController } from './payslip-reports.controller';
import { PaySlipReportsService } from './payslip-reports.service';

/** Rendering infrastructure comes from the global `RenderModule` — see IncidentReportsModule. */
@Module({
  controllers: [PaySlipReportsController],
  providers: [PaySlipReportsService],
})
export class PaySlipReportsModule {}
