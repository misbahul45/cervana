import type { PaginationMeta } from "."

export enum TeacherStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface TeacherExperience {
  id: string
  title: string
  institution?: string | null
  startDate: Date | string
  endDate?: Date | string | null
  description?: string | null
}

export interface Certification {
  id: string
  name: string
  issuer?: string | null
  issuedDate?: Date | string | null
  expirationDate?: Date | string | null
  credentialUrl?: Record<string, any> | null
  credentialId?: string | null
}

export interface BaseTeacher {
  id: string
  userId: string
  name: string
  bio?: string | null
  cvUrl?: string | null
  portfolioUrl?: string | null
  expertise?: string | null
  status: TeacherStatus
  createdAt: Date | string
  updatedAt: Date | string
}

export type TeacherDetailResponse<
  IncludeRelations extends boolean = false
> = BaseTeacher &
  (IncludeRelations extends true
    ? {
        experiences: TeacherExperience[]
        certifications: Certification[]
      }
    : {})

export interface TeachersListResponse<
  IncludeRelations extends boolean = false
> {
  data: (IncludeRelations extends true
    ? TeacherDetailResponse<true>
    : BaseTeacher)[]
  pagination: PaginationMeta
}
