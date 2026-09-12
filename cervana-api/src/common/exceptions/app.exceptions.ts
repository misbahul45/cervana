import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { AppError } from '../lib/error';
import { ApiResponse } from '../interfaces';

@Catch()
export class AppExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const requestId = req.headers['x-request-id']?.toString() || uuid();
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Terjadi kesalahan pada server';
    let errorName = 'InternalServerError';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let stack: string | undefined;

    // === Custom AppError ===
    if (exception instanceof AppError) {
      status = exception.statusCode;
      message = exception.message;
      errorName = exception.name;
      errorCode = exception.code;
      if (process.env.NODE_ENV !== 'production') {
        stack = exception.stack;
      }
    }

    // === NestJS HttpException ===
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const r = response as any;
        message = r.message || message;
        errorCode = r.error || errorCode;
      }

      errorName = exception.name;
      if (process.env.NODE_ENV !== 'production') {
        stack = exception.stack;
      }
    }

    // === Error Biasa ===
    else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name;
      if (process.env.NODE_ENV !== 'production') {
        stack = exception.stack;
      }
    }

    // === Logging (bisa ganti ke Sentry) ===
    this.logger.error(
      `[${requestId}] ${errorName}: ${message}`,
      stack,
      'AppExceptionsFilter',
    );

    const responseBody: ApiResponse<null> = {
      success: false,
      message,
      error: {
        name: errorName,
        code: errorCode,
        ...(process.env.NODE_ENV !== 'production' && stack ? { stack } : {}),
      },
      data: null,
      meta: {
        requestId,
        timestamp,
        statusCode: status,
      },
    };

    res.status(status).json(responseBody);
  }
}
