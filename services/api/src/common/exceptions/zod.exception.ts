// zod.exception.ts

import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';
import { Response, Request } from 'express';
import { v4 as uuid } from 'uuid';

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = 400;
    const requestId = request.headers['x-request-id']?.toString() || uuid();
    const timestamp = new Date().toISOString();

    const formattedErrors =
      Array.isArray(exception?.issues) && exception.issues.length > 0
        ? exception.issues.map((issue) => ({
            message: issue.message,
            path: issue.path,
          }))
        : [
            {
              message: exception.message ?? 'Zod validation error',
              path: [],
            },
          ];

    const errorPayload = {
      type: 'ZodValidationError',
      details: formattedErrors,
    };

    response.status(status).json({
      success: false,
      message: 'Validation failed',
      data: null,
      error: errorPayload,
      meta: {
        requestId,
        timestamp,
        statusCode: status,
      },
    });
  }
}
