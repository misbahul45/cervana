import { isNavActive } from '~/lib/nav';

export interface StudioNavItem {
  id: string;
  label: string;
  to: string;
  icon: string;
  exact?: boolean;
}

export const STUDIO_NAV: ReadonlyArray<StudioNavItem> = [
  { id: 'home', label: 'Beranda', to: '/studio', icon: 'i-lucide-layout-dashboard', exact: true },
  { id: 'articles', label: 'Artikel', to: '/studio/articles', icon: 'i-lucide-file-text' },
  { id: 'classes', label: 'Kelas', to: '/studio/classes', icon: 'i-lucide-graduation-cap' },
  { id: 'analytics', label: 'Analitik', to: '/studio/analytics', icon: 'i-lucide-chart-no-axes-column' },
  { id: 'earnings', label: 'Pendapatan', to: '/studio/earnings', icon: 'i-lucide-wallet' },
  { id: 'payouts', label: 'Pencairan', to: '/studio/payouts', icon: 'i-lucide-banknote' },
  { id: 'settings', label: 'Pengaturan', to: '/studio/settings', icon: 'i-lucide-settings' },
];

export function studioNavActive(item: StudioNavItem, path: string): boolean {
  const current = path.split(/[?#]/)[0] ?? '';
  const clean = current.length > 1 ? current.replace(/\/+$/, '') : current;
  return item.exact ? clean === item.to : isNavActive(item.to, clean);
}
