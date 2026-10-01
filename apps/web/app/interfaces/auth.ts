// app/plugins/auth.server.ts
export type User = {
  id: string
  email: string
  role: 'STUDENT' | 'ADMIN' | 'TEACHER'
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
  role: 'STUDENT' | 'ADMIN' | 'TEACHER'
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