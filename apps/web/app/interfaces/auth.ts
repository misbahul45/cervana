import type { Capability, TenantRole, UserRole } from '~/lib/route-meta'

export type User = {
  id: string
  email: string
  role: UserRole
  tenantRoles?: TenantRole[]
  capabilities?: Capability[]
  name: string
  isActive: boolean
  emailVerified: string | null
  provider: 'JWT' | 'Google'
  image:{
    url: string;
    fileId?: string;
  } | null;
}



export interface RegisterResponse {
  id: string
  email: string
}


export interface LoginResponse {
  id: string
  email: string
  role: UserRole
  access_token:string;
  refresh_token:string;
}


export interface ProfileResponse {
  user: User
}

export interface CheckResponse {
  authenticated: boolean
  user: User
}

export interface refreshTokenResponse {
    access_token:string;
    refresh_token:string;
}