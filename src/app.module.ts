import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TransformInterceptor } from './common/json-respons-files/transform.interceptor';
import { HttpExceptionFilter } from './common/json-respons-files/http-exception.filter';
import { AppLoggerModule } from './common/logger/logger.module';
import { SharedModule } from './common/shared/shared.module';
import { RenderModule } from './common/render/render.module';
import { EvaluationReportsModule } from './modules/evaluation-report/evaluation-reports.module';
import { IncidentReportsModule } from './modules/incident-report/incident-reports.module';
import { InvoiceReportsModule } from './modules/invoice-report/invoice-reports.module';
import { ReceiptReportsModule } from './modules/receipt-report/receipt-reports.module';
import { PaySlipReportsModule } from './modules/payslip-report/payslip-reports.module';

/**
 * This service renders assembled report payloads into PDFs. It holds no database
 * connections: the `TypeOrmModule.forRoot()` registrations and the MSSQL/tedious client
 * modules that used to be wired here were only ever used by report code that has since
 * moved to Nursery, which owns every query, authorization check and calculation.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppLoggerModule,
    SharedModule,
    RenderModule,

    // Feature Modules
    EvaluationReportsModule,
    IncidentReportsModule,
    InvoiceReportsModule,
    ReceiptReportsModule,
    PaySlipReportsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
