import { I18nResolver } from 'nestjs-i18n';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserAgentLangResolver implements I18nResolver {
  resolve(context: any): string | string[] | Promise<string | string[]> {
    const req = context.switchToHttp().getRequest();
    const userAgent = req.headers['user-agent'];
    const match = userAgent?.match(/Lang\/([a-zA-Z-]+)/);
    return match ? match[1] : "en"; // Default to 'en' if not found
  }
}