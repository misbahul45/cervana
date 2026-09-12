import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response, Request } from 'express';
import { v4 as uuid } from 'uuid';

interface StandardResponse {
  message?: string;
  data?: any;
  [key: string]: any;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const statusCode = res.statusCode || 200;
    const requestId = req.headers['x-request-id']?.toString() || uuid();
    const timestamp = new Date().toISOString();

    return next.handle().pipe(
      map((originalResponse) => {
        if (this.isStandardResponse(originalResponse)) {
          const { message, data, ...rest } = originalResponse;
          
          return {
            success: true,
            message: message || 'Operation successful',
            data: data !== undefined ? data : null,
            meta: {
              requestId,
              timestamp,
              statusCode,
            },
            ...rest,
          };
        }

        return {
          success: true,
          message: 'Operation successful',
          data: originalResponse,
          meta: {
            requestId,
            timestamp,
            statusCode,
          },
        };
      }),
    );
  }

  private isStandardResponse(obj: any): obj is StandardResponse {
    return (
      obj &&
      typeof obj === 'object' &&
      obj !== null &&
      !Array.isArray(obj) &&
      (obj.hasOwnProperty('message') || obj.hasOwnProperty('data'))
    );
  }
}