import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
// import path from 'path';
import * as path from 'path';
import { UserAgentLangResolver } from 'src/common/resolvers/UserAgentLangResolver';
import { icareDbConfig, isecureDbConfig } from 'src/config/database.config';

@Module({
    imports: [
        TypeOrmModule.forRoot(icareDbConfig),
        TypeOrmModule.forRoot(isecureDbConfig),
        I18nModule.forRoot({
        fallbackLanguage: 'en',
        loaderOptions: {
            path: path.join(__dirname, '../../i18n/'),
            watch: true,
            includeSubfolders: true,
        },
        resolvers: [
                { use: QueryResolver, options: ['lang'] }, // ?lang=ar
                UserAgentLangResolver,
                new HeaderResolver(['x-custom-lang']),    // custom header
                AcceptLanguageResolver,                   // standard Accept-Language header
            ],
        }),
            ],
        })
export class SharedModule {}
