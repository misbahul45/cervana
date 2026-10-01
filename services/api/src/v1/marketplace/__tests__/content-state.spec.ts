import { ContentStatus } from '@prisma/client';
import {
  assertContentTransition,
  assertEditable,
  canTransitionContent,
  EDITABLE_CONTENT_STATES,
  READABLE_BY_BUYERS,
} from '../content-state';

describe('content state machine', () => {
  const allowed: Array<[ContentStatus, ContentStatus]> = [
    ['DRAFT', 'PENDING_REVIEW'],
    ['DRAFT', 'ARCHIVED'],
    ['PENDING_REVIEW', 'PUBLISHED'],
    ['PENDING_REVIEW', 'REJECTED'],
    ['PENDING_REVIEW', 'DRAFT'],
    ['REJECTED', 'PENDING_REVIEW'],
    ['REJECTED', 'ARCHIVED'],
    ['PUBLISHED', 'SUSPENDED'],
    ['PUBLISHED', 'ARCHIVED'],
    ['SUSPENDED', 'PUBLISHED'],
    ['SUSPENDED', 'ARCHIVED'],
  ];

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(canTransitionContent(from, to)).toBe(true);
    expect(() => assertContentTransition(from, to)).not.toThrow();
  });

  const statuses = Object.values(ContentStatus);
  const forbidden = statuses.flatMap((from) =>
    statuses
      .filter((to) => !allowed.some(([f, t]) => f === from && t === to))
      .map((to): [ContentStatus, ContentStatus] => [from, to]),
  );

  it.each(forbidden)('rejects %s -> %s', (from, to) => {
    expect(canTransitionContent(from, to)).toBe(false);
    expect(() => assertContentTransition(from, to)).toThrow(/cannot move/);
  });

  it('never publishes without going through review', () => {
    expect(canTransitionContent('DRAFT', 'PUBLISHED')).toBe(false);
    expect(canTransitionContent('REJECTED', 'PUBLISHED')).toBe(false);
  });

  it('archived content is final', () => {
    for (const to of statuses) expect(canTransitionContent('ARCHIVED', to)).toBe(false);
  });

  it('only drafts and rejected content can be edited', () => {
    expect([...EDITABLE_CONTENT_STATES].sort()).toEqual(['DRAFT', 'REJECTED']);
    for (const status of statuses) {
      if (EDITABLE_CONTENT_STATES.includes(status)) {
        expect(() => assertEditable(status)).not.toThrow();
      } else {
        expect(() => assertEditable(status)).toThrow(/cannot be edited/);
      }
    }
  });

  it('buyers keep reading archived content but never suspended or unreviewed content', () => {
    expect([...READABLE_BY_BUYERS].sort()).toEqual(['ARCHIVED', 'PUBLISHED']);
  });
});
