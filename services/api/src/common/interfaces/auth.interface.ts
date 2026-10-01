import { AuthProvider, Role } from "@prisma/client";

export interface RegisterResponse {
  data:{
      id:string;
      email: string;
  }
  message: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  sessionToken?: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  emailVerified: Date | null;
  image?: {
    url: string;
    fileId?: string;
  } | null;
  provider: AuthProvider;
}



export interface AuthResponse {
  message: string;
  user?: AuthUser;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}


export interface GoogleLoginResponse {
  message: string;
  data: {
    id: string;
    email: string;
  };
  tokens:TokenPair
}

export interface SendOtpResponse {
  success: boolean;
}

export interface VerifyOtpResponse {
  message: string;
  data: null;
}

export interface LoginResponse {
  sub: string;
  email: string;
  role: Role;
}
