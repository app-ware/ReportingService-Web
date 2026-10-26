import { Module } from '@nestjs/common';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';
import { UserAgentLangResolver } from 'src/common/resolvers/UserAgentLangResolver';

/**
 * Cross-cutting concerns shared by every module.
 *
 * The two `TypeOrmModule.forRoot()` registrations that used to live here (duplicating the
 * pair in `AppModule`) are gone: the active report implementations render an assembled
 * payload and never touch a database, so the service no longer opens MSSQL connections
 * at all.
 */
@Module({
  imports: [
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
        new HeaderResolver(['x-custom-lang']), // custom header
        AcceptLanguageResolver, // standard Accept-Language header
      ],
    }),
  ],
  exports: [I18nModule],
})
export class SharedModule {}
