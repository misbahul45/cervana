import type { ThemeIconName } from '~/theme/icons';

export type NavIcon = { kind: 'game'; name: ThemeIconName } | { kind: 'ui'; name: string };

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: NavIcon;
  tab: boolean;
}

export const LEARNER_NAV: ReadonlyArray<NavItem> = [
  { id: 'home', label: 'Beranda', to: '/learn/profile/dashboard', icon: { kind: 'ui', name: 'i-lucide-house' }, tab: true },
  { id: 'topics', label: 'Topik', to: '/learn/topics', icon: { kind: 'ui', name: 'i-lucide-book-open' }, tab: true },
  { id: 'practice', label: 'Latihan', to: '/sandbox', icon: { kind: 'ui', name: 'i-lucide-dumbbell' }, tab: false },
  { id: 'leaderboard', label: 'Peringkat', to: '/learn/leaderboard', icon: { kind: 'game', name: 'league' }, tab: true },
  { id: 'achievements', label: 'Pencapaian', to: '/learn/achievements', icon: { kind: 'game', name: 'badge' }, tab: true },
  { id: 'streaks', label: 'Streak', to: '/learn/streaks', icon: { kind: 'game', name: 'streak' }, tab: false },
  { id: 'profile', label: 'Profil', to: '/learn/profile/me', icon: { kind: 'ui', name: 'i-lucide-user-round' }, tab: true },
  { id: 'market', label: 'Marketplace', to: '/marketplace', icon: { kind: 'ui', name: 'i-lucide-store' }, tab: false },
  { id: 'support', label: 'Bantuan', to: '/learn/support', icon: { kind: 'ui', name: 'i-lucide-life-buoy' }, tab: false },
];

export const tabItems = (): NavItem[] => LEARNER_NAV.filter((item) => item.tab);

const pathOf = (route: string): string => {
  const clean = route.split(/[?#]/)[0] ?? '';
  return clean.length > 1 ? clean.replace(/\/+$/, '') : clean;
};

export const isNavActive = (target: string, route: string): boolean => {
  const current = pathOf(route);
  return current === target || current.startsWith(`${target}/`);
};

const FOCUS_AREAS = ['/my-learning/sub-topics', '/my-learning/lessons', '/my-learning/quizzes'] as const;

const underArea = (path: string, area: string) => path === area || path.startsWith(`${area}/`);

export const fallbackLayout = (path: string, declared: string | undefined, signedIn: boolean): string | false | undefined => {
  if (declared) return undefined;
  const current = pathOf(path);
  if (underArea(current, '/learn')) return 'learn';
  if (underArea(current, '/my-learning/steps')) return 'steps';
  if (FOCUS_AREAS.some((area) => underArea(current, area))) return 'focus';
  if (underArea(current, '/my-learning')) return 'learning';
  return signedIn ? 'learner' : 'public';
};
