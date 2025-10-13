import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

export const icareDbConfig: TypeOrmModuleOptions = {
    name: 'icare',
    type: 'mssql',
    host: process.env.ICARE_DB_HOST,
    port: Number(process.env.ICARE_DB_PORT),
    username: process.env.ICARE_DB_USER,
    password: process.env.ICARE_DB_PASS,
    database: process.env.ICARE_DB_NAME,
    entities: [
           path.join(__dirname, '/../database/icare/entities/entities/*{.ts,.js}'),
           path.join(__dirname, '/../database/icare/entities/views/*{.ts,.js}')

    ],
    synchronize: false,
    options: { encrypt: false },
};

export const isecureDbConfig: TypeOrmModuleOptions = {
    name: 'isecure',
    type: 'mssql',
    host: process.env.ISECURE_DB_HOST,
    port: Number(process.env.ISECURE_DB_PORT),
    username: process.env.ISECURE_DB_USER,
    password: process.env.ISECURE_DB_PASS,
    database: process.env.ISECURE_DB_NAME,
    entities: [
        path.join(__dirname, '/../database/isecure/entities/entities/*{.ts,.js}')
    ],
    synchronize: false,
    options: { encrypt: false },
};