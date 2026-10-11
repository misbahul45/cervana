export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_SUBMITTED'
  | 'PAID'
  | 'FULFILLED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface OrderItemView {
  id: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  articleId: string | null;
  classId: string | null;
  topicId: string | null;
  article?: { title: string } | null;
  classProduct?: { title: string } | null;
  topic?: { title: string } | null;
}

export interface ManualAccountView {
  method: string;
  label: string;
  accountNumber: string;
  accountName: string;
}

export interface PaymentView {
  id: string;
  provider: string;
  status: string;
  amount: string | number;
  currency: string;
  expiresAt: string;
  paidAt: string | null;
  presentation: {
    type: string;
    data: {
      amount: string;
      currency: string;
      referenceCode: string;
      expiresAt: string;
      accounts: ManualAccountView[];
    };
  } | null;
}

export interface OrderView {
  id: string;
  status: OrderStatus;
  subtotal: string | number;
  platformFee: string | number;
  total: string | number;
  currency: string;
  createdAt: string;
  expiredAt: string;
  paidAt: string | null;
  items: OrderItemView[];
  payment: PaymentView | null;
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface PayoutView {
  id: string;
  amount: string | number;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PAID' | 'REJECTED' | 'CANCELLED';
  destinationInfo: { bankName: string; accountNumber: string; accountName: string } | null;
  requestedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
}

export interface MarketplaceArticleView {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  coverImage: { url: string } | null;
  accessType: 'FREE' | 'PAID';
  price: string | number | null;
  currency: string;
  publishedAt: string | null;
  category: { id: string; name: string } | null;
  author: { id: string; name: string; image: { url: string } | null } | null;
  tenant: { id: string; name: string; slug: string; logo: { url: string } | null } | null;
}

export interface MarketplaceClassView {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  coverImage: { url: string } | null;
  accessType: 'FREE' | 'PAID';
  price: string | number | null;
  currency: string;
  format: string;
  difficulty: string;
  durationMinutes: number | null;
  capacity: number | null;
  seatsLeft: number | null;
  publishedAt: string | null;
  instructor: { id: string; name: string; image: { url: string } | null } | null;
  tenant: { id: string; name: string; slug: string; logo: { url: string } | null } | null;
  sessions?: Array<{ id: string; startsAt: string; endsAt: string; status: string }>;
}

export interface ClassMaterialsView {
  classId: string;
  title: string;
  description: string | null;
  sessions: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    meetingUrl: string | null;
    recordingUrl: string | null;
  }>;
}

export interface EnrollmentView {
  id: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  classProduct: { id: string; title: string; slug: string | null; coverImage: { url: string } | null; format: string; tenant: { id: string; name: string; slug: string } | null };
}

export type ContentStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export interface StudioArticleSummary {
  id: string;
  title: string;
  status: ContentStatus;
  updatedAt: string;
}

export interface StudioArticle extends StudioArticleSummary {
  excerpt: string | null;
  accessType: 'FREE' | 'PAID';
  price: string | number | null;
  currency: string;
  reviewNote: string | null;
  publishedAt: string | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    title: string;
    content: string;
    publishedAt: string | null;
  }>;
}

export type ManualPaymentStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface ManualSubmissionView {
  id: string;
  status: ManualPaymentStatus;
  paymentMethod: string;
  referenceNumber: string | null;
  amount: string | number;
  note: string | null;
  proofUrl: { url: string; fileId?: string } | null;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  payer: { id: string; name: string; email: string };
  order: {
    id: string;
    status: OrderStatus;
    total: string | number;
    currency: string;
    createdAt: string;
    items: OrderItemView[];
  };
  paymentIntent: { id: string; status: string; amount: string | number; currency: string; expiresAt: string };
}

export interface CreatorProfileView {
  id: string;
  fullName: string;
  bio: string | null;
  portfolioUrl: string | null;
  articles: Array<Omit<MarketplaceArticleView, 'category' | 'author' | 'tenant'>>;
  classes: Array<Omit<MarketplaceClassView, 'capacity' | 'seatsLeft' | 'instructor' | 'tenant' | 'sessions'>>;
  badges: Array<{ id: string; title: string; description: string | null; icon: string | null; iconName: string | null; awardedAt: string }>;
}

export interface StudioClassSummary {
  id: string;
  title: string;
  status: ContentStatus;
  accessType: 'FREE' | 'PAID';
  price: string | number | null;
  currency: string;
  format: string;
  difficulty: string;
  durationMinutes: number | null;
  capacity: number | null;
  updatedAt: string;
}

export interface StudioClassSession {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  meetingUrl: string | null;
  recordingUrl: string | null;
}

export interface StudioClass extends StudioClassSummary {
  description: string | null;
  reviewNote: string | null;
  publishedAt: string | null;
  sessions: StudioClassSession[];
  _count: { enrollments: number };
}

export interface TeacherApplicationView {
  id: string;
  fullName: string;
  bio: string | null;
  expertise: string | null;
  portfolioUrl: string | null;
  cvUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  feedback: string | null;
  createdAt: string;
  reviewedAt: string | null;
}
