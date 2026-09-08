import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TransformInterceptor } from './common/json-respons-files/transform.interceptor';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { icareDbConfig, isecureDbConfig } from './config/database.config';
import { HttpExceptionFilter } from './common/json-respons-files/http-exception.filter';
import { MssqlClientModule } from './config/mssql/mssql-client.module';
import { AppLoggerModule } from './common/logger/logger.module';
import { EvaluationReportsModule } from './modules/evaluation-report/evaluation-reports.module';
import { IncidentReportsModule } from './modules/incident-report/incident-reports.module';
import { InvoiceReportsModule } from './modules/invoice-report/invoice-reports.module';
import { SharedModule } from './common/shared/shared.module';




@Module({
  imports: [
    //Common imports
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(icareDbConfig),
    TypeOrmModule.forRoot(isecureDbConfig),
    MssqlClientModule,AppLoggerModule,SharedModule,

    //Feature Modules
    EvaluationReportsModule,
    IncidentReportsModule,
    InvoiceReportsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },

  ]
})
export class AppModule { }