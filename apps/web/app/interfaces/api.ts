export enum AppErrorCode {
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",

  EMAIL_VERIFICATION_FAILED = "EMAIL_VERIFICATION_FAILED",
  INVALID_OTP = "INVALID_OTP",
  EXPIRED_OTP = "EXPIRED_OTP",
  EMAIL_ALREADY_REGISTERED = "EMAIL_ALREADY_REGISTERED",

  RESEND_ERROR = "RESEND_ERROR",
  EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED",

  USER_NOT_FOUND = "USER_NOT_FOUND",
  USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",

  DB_CONNECTION_ERROR = "DB_CONNECTION_ERROR",
  UNIQUE_CONSTRAINT_FAILED = "UNIQUE_CONSTRAINT_FAILED",

  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

export interface PaginationMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface ResponseMeta {
  requestId?: string;
  timestamp?: string;
  statusCode?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  code?: AppErrorCode;
  data?: T | null;
  meta?: ResponseMeta;
  error?: string
}

export interface Query {
  page?: number;              
  limit?: number;              
  q?: string;                  
  sort?: string;             
  include?: string | string[]; 
  [key: string]: any;           
}

export interface Tokens {
  access_token?: string
  refresh_token?: string
}
