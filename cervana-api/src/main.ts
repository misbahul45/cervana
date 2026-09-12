import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppExceptionsFilter } from './common/exceptions/app.exceptions';
import { ZodExceptionFilter } from './common/exceptions/zod.exception';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const cookieSecret = configService.get<string>('COOKIE_SECRET') || 'your-secret-key';
  app.use(cookieParser(cookieSecret));

  const APP_VERSION = process.env.APP_VERSION ?? 'v1';
  const PORT = process.env.PORT ?? 3001;

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    'https://cervana.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Cervana API')
    .setDescription('API Documentation for Cervana Backend')
    .setVersion(APP_VERSION)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`api/${APP_VERSION}/docs`, app, document);

  app.setGlobalPrefix(`api/${APP_VERSION}`);
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AppExceptionsFilter(), new ZodExceptionFilter());


  app.use(`/api/${APP_VERSION}/webhook/stripe`, express.raw({ type: 'application/json' }));

  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.use((req, res, next) => {
    console.log(`🛰️ [${req.method}] ${req.originalUrl}`);
    next();
  });

  app.getHttpAdapter().get('/', (req, res) => {
    res.redirect(`/api/${APP_VERSION}/docs`);
  });

  await app.listen(PORT);

  console.log(`🚀 Server running at: http://localhost:${PORT}/api/${APP_VERSION}`);
  console.log(`📚 Swagger docs at: http://localhost:${PORT}/api/${APP_VERSION}/docs`);
}
bootstrap();
