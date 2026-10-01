import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/auth/register', () => {
    it('rejects missing email', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ name: 'Test', password: 'Password123!' })
        .expect(400);
    });

    it('rejects missing password', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ name: 'Test', email: 'test@example.com' })
        .expect(400);
    });

    it('rejects malformed email', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          name: 'Test',
          email: 'not-an-email',
          password: 'Password123!',
        })
        .expect(400);
    });
  });

  describe('POST /v1/auth/login', () => {
    it('rejects missing body', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({})
        .expect(400);
    });

    it('rejects missing credentials', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);
    });
  });

  describe('GET /v1/auth/profile', () => {
    it('returns 401 without bearer token', () => {
      return request(app.getHttpServer())
        .get('/v1/auth/profile')
        .expect(401);
    });

    it('returns 401 with malformed bearer', () => {
      return request(app.getHttpServer())
        .get('/v1/auth/profile')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });
  });

  describe('GET /v1/auth/check', () => {
    it('returns 401 without bearer token', () => {
      return request(app.getHttpServer())
        .get('/v1/auth/check')
        .expect(401);
    });
  });

  describe('POST /v1/auth/forgot-password', () => {
    it('rejects missing email', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({})
        .expect(400);
    });
  });

  describe('POST /v1/auth/refresh-token', () => {
    it('returns 401 without refresh token cookie', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/refresh-token')
        .expect(401);
    });
  });
});