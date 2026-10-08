import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';

// Response Schemas untuk Auth
export const LoginResponseSchema = extendApi(
  z.object({
    id: z.string().describe('Unique user identifier'),
    email: z.string().email().describe('User email address'),
    role: z.enum(['STUDENT', 'ADMIN', 'TEACHER', 'REVIEWER']).describe('User role'),
  }),
  {
    title: 'LoginResponse',
    example: {
      id: 'user-uuid-123',
      email: 'user@example.com',
      role: 'STUDENT'
    }
  }
);

export const RegisterResponseSchema = extendApi(
  z.object({
    id: z.string().describe('Unique user identifier'),
    email: z.string().email().describe('User email address'),
  }),
  {
    title: 'RegisterResponse',
    example: {
      id: 'user-uuid-123',
      email: 'user@example.com'
    }
  }
);

export const UserProfileSchema = extendApi(
  z.object({
    id: z.string().describe('Unique user identifier'),
    name: z.string().describe('User full name'),
    email: z.string().email().describe('User email address'),
    role: z.enum(['STUDENT', 'ADMIN', 'TEACHER', 'REVIEWER']).describe('User role'),
    isActive: z.boolean().describe('Whether user account is active'),
    emailVerified: z.date().nullable().describe('Email verification timestamp'),
    image: z.string().url().nullable().describe('User profile image URL'),
    provider: z.enum(['JWT', 'Google']).describe('Authentication provider'),
  }),
  {
    title: 'UserProfile',
    example: {
      id: 'user-uuid-123',
      name: 'John Doe',
      email: 'user@example.com',
      role: 'STUDENT',
      isActive: true,
      emailVerified: '2024-01-01T00:00:00.000Z',
      image: 'https://example.com/avatar.jpg',
      provider: 'JWT'
    }
  }
);

export const AuthCheckResponseSchema = extendApi(
  z.object({
    authenticated: z.boolean().describe('Authentication status'),
    user: UserProfileSchema.extend({
      tenantRoles: z.array(z.enum(['OWNER', 'MANAGER', 'TEACHER', 'EDITOR'])).describe('Distinct roles from active tenant memberships'),
      capabilities: z.array(z.enum(['ADMIN', 'REVIEWER', 'CREATOR'])).describe('Capabilities derived from role and memberships'),
    }).describe('Current user data'),
  }),
  {
    title: 'AuthCheckResponse',
    example: {
      authenticated: true,
      user: {
        id: 'user-uuid-123',
        name: 'John Doe',
        email: 'user@example.com',
        role: 'STUDENT',
        isActive: true,
        emailVerified: '2024-01-01T00:00:00.000Z',
        image: null,
        provider: 'JWT',
        tenantRoles: [],
        capabilities: []
      }
    }
  }
);
