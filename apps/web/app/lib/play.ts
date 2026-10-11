import type { CalendarDayState } from '~/interfaces/gamify';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'gold' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export const buttonClasses = ({ variant = 'primary', size = 'md', block = false }: ButtonOptions): string[] => {
  const classes = ['rc-btn'];
  if (variant !== 'primary') classes.push(`rc-btn--${variant}`);
  if (size !== 'md') classes.push(`rc-btn--${size}`);
  if (block) classes.push('rc-btn--block');
  return classes;
};

export const progressWidth = (value: number): string => {
  const safe = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return `${safe}%`;
};

export const ringDash = (progress: number, radius: number): { circumference: number; offset: number } => {
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return { circumference, offset: circumference * (1 - filled) };
};

const DAY_LABELS: Readonly<Record<CalendarDayState, string>> = {
  done: 'Selesai',
  frozen: 'Dibekukan',
  missed: 'Terlewat',
  today: 'Hari ini',
};

export const dayStateLabel = (state: CalendarDayState): string => DAY_LABELS[state];
