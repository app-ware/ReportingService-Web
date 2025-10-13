import { Logger } from '@nestjs/common';
import * as sql from 'mssql';
import { ICARE_MSSQL_POOL, ISECURE_MSSQL_POOL } from './mssql-client.constants';

const logger = new Logger('NativeClientProviders');

async function createPoolFactory(config: sql.config, poolName: string): Promise<sql.ConnectionPool> {
    try {
        logger.log(`Initializing native mssql pool: [${poolName}]`);
        const pool = new sql.ConnectionPool(config);
        const connectedPool = await pool.connect();
        logger.log(` Native mssql pool ready: [${poolName}]`);
        return connectedPool;
    } catch (error) {
        logger.error(` Failed to initialize mssql pool: [${poolName}]`, error.stack);
        throw error;
    }
}

export const nativeClientProviders = [
    {
        provide: ICARE_MSSQL_POOL,
        useFactory: () => createPoolFactory({
            user: process.env.ICARE_DB_USER,
            password: process.env.ICARE_DB_PASS,
            server: process.env.ICARE_DB_HOST,
            database: process.env.ICARE_DB_NAME,
            port: Number(process.env.ICARE_DB_PORT),
            pool: { max: 15, min: 2 },
            options: { trustServerCertificate: true },
        }, 'icare'),
    },
    {
        provide: ISECURE_MSSQL_POOL,
        useFactory: () => createPoolFactory({
            user: process.env.ISECURE_DB_USER,
            password: process.env.ISECURE_DB_PASS,
            server: process.env.ISECURE_DB_HOST,
            database: process.env.ISECURE_DB_NAME,
            port: Number(process.env.ISECURE_DB_PORT),
            pool: { max: 5, min: 1 },
            options: {  trustServerCertificate: true },
        }, 'isecure'),
    },
];