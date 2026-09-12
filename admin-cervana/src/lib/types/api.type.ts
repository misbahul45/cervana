import type { AppErrorCode } from "$lib/utils/error";

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
  data?: T;
  meta?: ResponseMeta;
  error?: {
    name?: string;
    code?: string;
    stack?: string;
    [key: string]: any;
  } | null;
}

export interface Query {
  page?: number;              
  limit?: number;              
  q?: string;                  
  sort?: string;             
  include?: string | string[]; 
  [key: string]: any;           
}
