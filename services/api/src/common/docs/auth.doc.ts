import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';

// Response Schemas untuk Auth
export const LoginResponseSchema = extendApi(
  z.object({
    id: z.string().describe('Unique user identifier'),
    email: z.string().email().describe('User email address'),
    role: z.enum(['USER', 'ADMIN', 'MODERATOR']).describe('User role'),
  }),
  {
    title: 'LoginResponse',
    example: {
      id: 'user-uuid-123',
      email: 'user@example.com',
      role: 'USER'
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
    role: z.enum(['USER', 'ADMIN', 'MODERATOR']).describe('User role'),
    isActive: z.boolean().describe('Whether user account is active'),
    emailVerified: z.date().nullable().describe('Email verification timestamp'),
    image: z.string().url().nullable().describe('User profile image URL'),
    provider: z.enum(['LOCAL', 'GOOGLE', 'FACEBOOK']).describe('Authentication provider'),
  }),
  {
    title: 'UserProfile',
    example: {
      id: 'user-uuid-123',
      name: 'John Doe',
      email: 'user@example.com',
      role: 'USER',
      isActive: true,
      emailVerified: '2024-01-01T00:00:00.000Z',
      image: 'https://example.com/avatar.jpg',
      provider: 'LOCAL'
    }
  }
);

export const AuthCheckResponseSchema = extendApi(
  z.object({
    authenticated: z.boolean().describe('Authentication status'),
    user: UserProfileSchema.describe('Current user data'),
  }),
  {
    title: 'AuthCheckResponse',
    example: {
      authenticated: true,
      user: {
        id: 'user-uuid-123',
        name: 'John Doe',
        email: 'user@example.com',
        role: 'USER',
        isActive: true,
        emailVerified: '2024-01-01T00:00:00.000Z',
        image: null,
        provider: 'LOCAL'
      }
    }
  }
);
