import { Module, Inject, OnModuleDestroy, Logger, Global } from '@nestjs/common';
import * as sql from 'mssql';
import { ICARE_MSSQL_POOL, ISECURE_MSSQL_POOL } from './mssql-client.constants';
import { nativeClientProviders } from './mssql-client.providers';

@Global() 
@Module({
    providers: [...nativeClientProviders],
    exports: [...nativeClientProviders],
})
export class MssqlClientModule implements OnModuleDestroy {
    private readonly logger = new Logger(MssqlClientModule.name);

    constructor(
        @Inject(ICARE_MSSQL_POOL) private readonly icarePool: sql.ConnectionPool,
        @Inject(ISECURE_MSSQL_POOL) private readonly isecurePool: sql.ConnectionPool,
    ) {}

    async onModuleDestroy() {
        if (this.icarePool) await this.icarePool.close();
        if (this.isecurePool) await this.isecurePool.close();
        this.logger.log('Native mssql pools closed.');
    }
}