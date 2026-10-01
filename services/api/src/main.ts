import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppExceptionsFilter } from './common/exceptions/app.exceptions';
import { ZodExceptionFilter } from './common/exceptions/zod.exception';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import { parseOrigins } from './common/lib/parse-origins';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.useBodyParser('json', { limit: '1mb' });

  const configService = app.get(ConfigService);
  const cookieSecret =
    configService.get<string>('COOKIE_SECRET') ||
    (process.env.NODE_ENV === 'production' ? undefined : randomBytes(32).toString('hex'));
  if (!cookieSecret) {
    throw new Error('COOKIE_SECRET must be set');
  }
  app.use(cookieParser(cookieSecret));

  const APP_VERSION = process.env.APP_VERSION ?? 'v1';
  const PORT = process.env.PORT ?? 3001;

  const extraOrigins = parseOrigins(process.env.CORS_EXTRA_ORIGINS);

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    ...extraOrigins,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter((origin): origin is string => Boolean(origin));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('ReduCera API')
    .setDescription('API Documentation for ReduCera Backend')
    .setVersion(APP_VERSION)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`api/${APP_VERSION}/docs`, app, document);

  app.setGlobalPrefix(`api/${APP_VERSION}`);
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AppExceptionsFilter(), new ZodExceptionFilter());



  app.use((req, res, next) => {
    console.log(`🛰️ [${req.method}] ${req.originalUrl}`);
    next();
  });

  app.getHttpAdapter().get('/', (_req: unknown, res: { redirect: (url: string) => void }) => {
    res.redirect(`/api/${APP_VERSION}/docs`);
  });

  await app.listen(PORT);

  console.log(`🚀 Server running at: http://localhost:${PORT}/api/${APP_VERSION}`);
  console.log(`📚 Swagger docs at: http://localhost:${PORT}/api/${APP_VERSION}/docs`);
}
bootstrap();
