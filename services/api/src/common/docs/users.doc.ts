import { extendApi } from "@anatine/zod-openapi";
import z from "zod";

// Base User Schema
export const BaseUserSchema = z.object({
  id: z.string().describe('Unique user identifier'),
  name: z.string().describe('User full name'),
  email: z.string().email().describe('User email address'),
  emailVerified: z.date().nullable().describe('Email verification date'),
  image: z.string().nullable().describe('User profile image URL'),
  provider: z.enum(['Google', 'JWT']).describe('Authentication provider'),
  role: z.enum(['STUDENT', 'ADMIN', 'TEACHER']).describe('User role'),
  isActive: z.boolean().describe('User account status'),
  
  // Gamification fields
  totalPoints: z.number().describe('Total points earned by user'),
  souls: z.number().describe('User souls count'),
  stars: z.number().describe('User stars count'),
  
  // Streak fields
  currentStreak: z.number().describe('Current streak count'),
  longestStreak: z.number().describe('Longest streak achieved'),
  lastStreakDate: z.date().nullable().describe('Last streak activity date'),
  
  createdAt: z.date().describe('Account creation date'),
  updatedAt: z.date().describe('Last account update date'),
});

// User Detail Schema with relations
export const UserDetailSchema = extendApi(
  BaseUserSchema.extend({
    userTopics: z.array(z.object({
      id: z.string(),
      topicId: z.string(),
      status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED']),
      progressPercent: z.number(),
      topic: z.object({
        id: z.string(),
        title: z.string(),
        slug: z.string(),
        description: z.string().nullable(),
        difficultyLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
      })
    })).optional().describe('User learning topics'),
    
    achievements: z.array(z.object({
      id: z.string(),
      awardedAt: z.date(),
      achievement: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        icon: z.string().nullable(),
        type: z.enum(['STREAK', 'QUIZ', 'TOPIC', 'LESSON', 'SCORE', 'PARTICIPATION']),
      })
    })).optional().describe('User achievements'),
    
    leaderboard: z.object({
      id: z.string(),
      score: z.number(),
      rank: z.number(),
      updatedAt: z.date(),
    }).nullable().optional().describe('User leaderboard position'),
    
    _count: z.object({
      quizAttempts: z.number(),
      stepProgress: z.number(),
      notifications: z.number(),
      streakHistory: z.number(),
    }).optional().describe('Related records count'),
  }),
  {
    title: 'UserDetail',
    example: {
      id: 'user-uuid-123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      emailVerified: '2024-01-15T10:30:00Z',
      image: 'https://example.com/avatar.jpg',
      provider: 'JWT',
      role: 'STUDENT',
      isActive: true,
      totalPoints: 1250,
      souls: 5,
      stars: 12,
      currentStreak: 7,
      longestStreak: 15,
      lastStreakDate: '2024-08-07T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-08-08T12:00:00Z',
      userTopics: [
        {
          id: 'user-topic-1',
          topicId: 'topic-1',
          status: 'IN_PROGRESS',
          progressPercent: 75,
          topic: {
            id: 'topic-1',
            title: 'JavaScript Fundamentals',
            slug: 'javascript-fundamentals',
            description: 'Learn the basics of JavaScript',
            difficultyLevel: 'BEGINNER'
          }
        }
      ],
      achievements: [
        {
          id: 'user-achievement-1',
          awardedAt: '2024-08-01T00:00:00Z',
          achievement: {
            id: 'achievement-1',
            title: 'First Steps',
            description: 'Complete your first lesson',
            icon: '🎯',
            type: 'LESSON'
          }
        }
      ],
      leaderboard: {
        id: 'leaderboard-1',
        score: 1250,
        rank: 42,
        updatedAt: '2024-08-08T12:00:00Z'
      },
      _count: {
        quizAttempts: 8,
        stepProgress: 25,
        notifications: 3,
        streakHistory: 30
      }
    }
  }
);

// User List Schema for paginated results
export const UsersListSchema = extendApi(
  z.object({
    data: z.array(BaseUserSchema.extend({
      _count: z.object({
        quizAttempts: z.number(),
        stepProgress: z.number(),
        userTopics: z.number(),
      }).optional().describe('Related records count'),
    })).describe('Array of users'),
    
    pagination: z.object({
      page: z.number().describe('Current page number'),
      limit: z.number().describe('Items per page'),
      total: z.number().describe('Total number of users'),
      totalPages: z.number().describe('Total number of pages'),
      hasNext: z.boolean().describe('Has next page'),
      hasPrev: z.boolean().describe('Has previous page'),
    }).describe('Pagination information'),
  }),
  {
    title: 'UsersList',
    example: {
      data: [
        {
          id: 'user-uuid-123',
          name: 'John Doe',
          email: 'john.doe@example.com',
          emailVerified: '2024-01-15T10:30:00Z',
          image: 'https://example.com/avatar.jpg',
          provider: 'JWT',
          role: 'STUDENT',
          isActive: true,
          totalPoints: 1250,
          souls: 5,
          stars: 12,
          currentStreak: 7,
          longestStreak: 15,
          lastStreakDate: '2024-08-07T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-08-08T12:00:00Z',
          _count: {
            quizAttempts: 8,
            stepProgress: 25,
            userTopics: 3
          }
        },
        {
          id: 'user-uuid-456',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          emailVerified: '2024-02-01T09:15:00Z',
          image: null,
          provider: 'Google',
          role: 'STUDENT',
          isActive: true,
          totalPoints: 890,
          souls: 3,
          stars: 8,
          currentStreak: 3,
          longestStreak: 10,
          lastStreakDate: '2024-08-08T00:00:00Z',
          createdAt: '2024-01-20T00:00:00Z',
          updatedAt: '2024-08-08T08:30:00Z',
          _count: {
            quizAttempts: 5,
            stepProgress: 18,
            userTopics: 2
          }
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 156,
        totalPages: 16,
        hasNext: true,
        hasPrev: false
      }
    }
  }
);

