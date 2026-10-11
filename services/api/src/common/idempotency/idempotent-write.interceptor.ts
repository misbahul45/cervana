import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Observable, from, lastValueFrom, map } from 'rxjs';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotentWriteInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const method = String(context.switchToHttp().getRequest().method).toUpperCase();
    const statusCode: number =
      Reflect.getMetadata(HTTP_CODE_METADATA, context.getHandler()) ?? (method === 'POST' ? 201 : 200);

    return from(
      this.idempotency.execute(context, async () => ({
        statusCode,
        body: await lastValueFrom(next.handle()),
      })),
    ).pipe(map((result) => result.body));
  }
}
