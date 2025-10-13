import { Logger } from '@nestjs/common';
import { Connection } from 'tedious'; 
import { ICARE_TEDIOUS_CONNECTION, ISECURE_TEDIOUS_CONNECTION } from './tedious.constants';

const logger = new Logger('TediousProviders');

type TediousConfig = ConstructorParameters<typeof Connection>[0];

function createTediousConnectionFactory(config: TediousConfig, connectionName: string): Promise<Connection> {
    return new Promise((resolve, reject) => {
        logger.log(`Initializing tedious connection: [${connectionName}]`);
        const connection = new Connection(config);

        connection.on('connect', (err) => {
            if (err) {
                logger.error(`Failed to initialize tedious connection: [${connectionName}]`, err.stack);
                return reject(err);
            }
            logger.log(`Tedious connection ready: [${connectionName}]`);
            resolve(connection);
        });
        
        connection.connect();
    });
}

export const tediousProviders = [
    {
        provide: ICARE_TEDIOUS_CONNECTION,
        useFactory: () => createTediousConnectionFactory({
            server: process.env.ICARE_DB_HOST!,
            authentication: {
                type: 'default',
                options: {
                    userName: process.env.ICARE_DB_USER,
                    password: process.env.ICARE_DB_PASS,
                },
            },
            options: {
                database: process.env.ICARE_DB_NAME,
                port: Number(process.env.ICARE_DB_PORT),
                trustServerCertificate: true,
            },
        }, 'icare'),
    },
    {
        provide: ISECURE_TEDIOUS_CONNECTION,
        useFactory: () => createTediousConnectionFactory({
            server: process.env.ISECURE_DB_HOST!,
            authentication: {
                type: 'default',
                options: {
                    userName: process.env.ISECURE_DB_USER,
                    password: process.env.ISECURE_DB_PASS,
                },
            },
            options: {
                database: process.env.ISECURE_DB_NAME,
                port: Number(process.env.ISECURE_DB_PORT),
                trustServerCertificate: true,
            },
        }, 'isecure'),
    },
];