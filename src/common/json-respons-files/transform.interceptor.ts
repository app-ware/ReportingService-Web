import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from './api-response.dto';
import { Reflector } from '@nestjs/core';
import { RESPONSE_MESSAGE_KEY, ResponseMessage } from '../decorators/response-message.decorator';
import { I18nService } from 'nestjs-i18n';


@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private reflector: Reflector,private i18n: I18nService) {}
async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<ApiResponse<T>>> {
    
      const request = context.switchToHttp().getRequest();
      
      const lang = request.i18nLang || 'en'; 
      const responseMessageKey = this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getHandler()) ?? '';
      const translatedMsg = responseMessageKey == "" ? "" : await this.i18n.translate(this.mapToI18nKey(responseMessageKey, lang)) as string;
      return next.handle().pipe(
        map(response => {
          const jsonapi = { version: "1.0" };
          const meta = {
            apiVersion: '1.0',
            requestId: uuidv4(),
            timestamp: new Date().toISOString(),
          };

          // if it's a paginated response
          if (response && response.data && response.pagination) {
            return {
              jsonapi,
              meta,
              message: translatedMsg, 
              data: response.data,
              pagination: response.pagination,
              errors: null,
            };
          }

          // for single resource
          return {
            jsonapi,
            meta,
            message: translatedMsg, // Use translated message, not key
            data: response,
            errors: null,
          };
        }),
      );
    
  }


mapToI18nKey(messageKey: string, lang: string): string {
  return `${lang}.${messageKey}`;
}

}

