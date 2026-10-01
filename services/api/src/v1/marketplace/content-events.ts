export const ContentEvents = {
  ArticlePublished: 'ArticlePublished',
  ClassPublished: 'ClassPublished',
  ClassEnrolled: 'ClassEnrolled',
  ClassAttended: 'ClassAttended',
  ClassCompleted: 'ClassCompleted',
} as const;

export const ARTICLE_AGGREGATE = 'Article';
export const CLASS_AGGREGATE = 'ClassProduct';

export interface ArticlePublishedPayload {
  articleId: string;
  versionId: string;
  tenantId: string;
  authorId: string;
  accessType: string;
  price: string | null;
  currency: string;
}

export interface ClassPublishedPayload {
  classId: string;
  tenantId: string;
  instructorId: string;
  accessType: string;
  price: string | null;
  currency: string;
  format: string;
}

export interface ClassEnrollmentEventPayload {
  classId: string;
  enrollmentId: string;
  userId: string;
  tenantId: string;
  orderId: string | null;
}

export interface ClassAttendedPayload {
  classId: string;
  sessionId: string;
  userId: string;
  tenantId: string;
}
