import type { ApiResponse } from '~/interfaces/api';

export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 0) return 'network';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'unknown';
}

export interface ApiErrorInit {
  message: string;
  status?: number;
  code?: string;
  requestId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly code?: string;
  readonly requestId?: string;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status ?? 0;
    this.kind = kindFromStatus(this.status);
    this.code = init.code;
    this.requestId = init.requestId;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function toApiError(res: ApiResponse<unknown>): ApiError {
  return new ApiError({
    message: res.message || 'Request failed',
    status: res.meta?.statusCode ?? 0,
    code: res.code,
    requestId: res.meta?.requestId,
  });
}

export function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw toApiError(res);
  return res.data as T;
}

export function unwrapList<T>(res: ApiResponse<T[]>): T[] {
  if (!res.success) throw toApiError(res);
  return res.data ?? [];
}

export function describeApiError(error: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  if (!isApiError(error)) return fallback;
  if (error.kind === 'network') return 'Tidak dapat terhubung ke server. Periksa koneksi Anda.';
  if (error.kind === 'unauthorized') return 'Sesi Anda berakhir. Silakan masuk kembali.';
  if (error.kind === 'forbidden') return 'Anda tidak memiliki akses untuk tindakan ini.';
  if (error.kind === 'rate_limited') return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.';
  if (error.kind === 'server') return 'Server sedang bermasalah. Coba lagi beberapa saat.';
  return error.message || fallback;
}
