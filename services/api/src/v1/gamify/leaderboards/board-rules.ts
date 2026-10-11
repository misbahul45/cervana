import { z } from 'zod';

const OFFSET_HOURS = 7;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export interface BoardWindow {
  start: Date;
  end: Date;
  startDate: string;
}

export const weekWindow = (now: Date): BoardWindow => {
  const local = new Date(now.getTime() + OFFSET_HOURS * 3_600_000);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - sinceMonday * DAY_MS;
  const start = new Date(mondayLocal - OFFSET_HOURS * 3_600_000);
  return { start, end: new Date(start.getTime() + WEEK_MS), startDate: new Date(mondayLocal).toISOString().slice(0, 10) };
};

const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);

const membershipSchema = z
  .object({ optIn: z.boolean().optional(), handle: handleSchema.optional() })
  .strict()
  .refine((value) => value.optIn !== undefined || value.handle !== undefined);

export type MembershipInput = z.infer<typeof membershipSchema>;

export const parseMembershipInput = (input: unknown): MembershipInput | null => {
  const parsed = membershipSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
};
