import type { PaginationMeta } from "./api"
import type { User } from './auth'

// Base notification minimal
export interface BaseNotification {
  id: string
  userId?: string | null
  user?: User | null

  title: string
  body?: string | null

  type: NotificationType
  isGlobal: boolean

  readAt?: Date | null
  createdAt: Date | string
}

export interface NotificationDetailResponse<
  IncludeRelations extends boolean = false
> extends BaseNotification {
  user?: IncludeRelations extends true ? User : undefined
}

export interface NotificationsListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? NotificationDetailResponse<true>
    : NotificationDetailResponse<false>)[]
  pagination: PaginationMeta
}

export interface CurrentNotificationResponse<
  IncludeRelations extends boolean = false
> {
  current: NotificationDetailResponse<IncludeRelations> | null
}


export enum NotificationType {
  STREAK = 'STREAK',
  QUIZ = 'QUIZ',
  ACHIEVEMENT = 'ACHIEVEMENT',
  SYSTEM = 'SYSTEM',
}
