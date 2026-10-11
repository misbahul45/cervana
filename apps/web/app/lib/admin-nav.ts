export interface AdminNavItem {
  id: string;
  label: string;
  to: string;
  icon: string;
}

export const ADMIN_NAV: ReadonlyArray<AdminNavItem> = [
  { id: 'dashboard', label: 'Beranda', to: '/admin/dashboard', icon: 'i-lucide-layout-dashboard' },
  { id: 'analytics', label: 'Analitik', to: '/admin/analytics', icon: 'i-lucide-chart-column' },
  { id: 'payments', label: 'Pembayaran', to: '/admin/payments', icon: 'i-lucide-credit-card' },
  { id: 'payouts', label: 'Pencairan', to: '/admin/payouts', icon: 'i-lucide-banknote' },
  { id: 'refunds', label: 'Pengembalian dana', to: '/admin/refunds', icon: 'i-lucide-undo-2' },
  { id: 'moderation', label: 'Moderasi', to: '/admin/moderation', icon: 'i-lucide-shield-check' },
  { id: 'applications', label: 'Pendaftar kreator', to: '/admin/applications', icon: 'i-lucide-user-check' },
  { id: 'users', label: 'Pengguna', to: '/admin/users', icon: 'i-lucide-users' },
  { id: 'tenants', label: 'Tenant', to: '/admin/tenants', icon: 'i-lucide-building-2' },
  { id: 'audit', label: 'Audit', to: '/admin/audit', icon: 'i-lucide-scroll-text' },
];
