const BLOCKED = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

export function safeNext(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  const path = value.split(/[?#]/)[0] ?? '';
  if (BLOCKED.some((blocked) => path === blocked || path.startsWith(`${blocked}/`))) return null;
  return value;
}

export function loginHref(next: unknown): string {
  const safe = safeNext(next);
  return safe ? `/login?next=${encodeURIComponent(safe)}` : '/login';
}
