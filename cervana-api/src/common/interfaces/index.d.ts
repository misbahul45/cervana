export interface Meta {
  requestId?: string;
  timestamp: string;
  statusCode: number;
}

export interface Query {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  include?: string | string[];
  [key: string]: any;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  meta: Meta;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;


export interface ExtractResponse {
  text: string;
  fileUrl?: string;
}