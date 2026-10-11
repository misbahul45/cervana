import { describe, expect, it } from 'vitest';
import { LEARNER_NAV, fallbackLayout, isNavActive, tabItems } from '~/lib/nav';
import { THEME_ICON_NAMES } from '~/theme/icons';

describe('LEARNER_NAV', () => {
  it('has unique ids and unique targets, and Indonesian labels', () => {
    expect(new Set(LEARNER_NAV.map((i) => i.id)).size).toBe(LEARNER_NAV.length);
    expect(new Set(LEARNER_NAV.map((i) => i.to)).size).toBe(LEARNER_NAV.length);
    for (const item of LEARNER_NAV) expect(item.label.length).toBeGreaterThan(2);
  });

  it('uses only theme icons from the vocabulary for the gamification items, so a theme can restyle them', () => {
    for (const item of LEARNER_NAV.filter((i) => i.icon.kind === 'game')) {
      expect(THEME_ICON_NAMES as ReadonlyArray<string>).toContain(item.icon.name);
    }
    const gamify = LEARNER_NAV.filter((i) => ['leaderboard', 'achievements', 'streaks'].includes(i.id));
    expect(gamify.map((i) => i.icon.kind)).toEqual(['game', 'game', 'game']);
  });

  it('points the gamification items at the pages of the learn area', () => {
    const byId = Object.fromEntries(LEARNER_NAV.map((i) => [i.id, i.to]));

    expect(byId.leaderboard).toBe('/learn/leaderboard');
    expect(byId.achievements).toBe('/learn/achievements');
    expect(byId.streaks).toBe('/learn/streaks');
    expect(byId.home).toBe('/learn/profile/dashboard');
  });
});

describe('isNavActive', () => {
  it('matches the exact home page and not its profile siblings', () => {
    expect(isNavActive('/learn/profile/dashboard', '/learn/profile/dashboard')).toBe(true);
    expect(isNavActive('/learn/profile/dashboard', '/learn/profile/me')).toBe(false);
  });

  it('matches a section and everything below it, but not a longer sibling name', () => {
    expect(isNavActive('/learn/topics', '/learn/topics')).toBe(true);
    expect(isNavActive('/learn/topics', '/learn/topics/accounting/detail')).toBe(true);
    expect(isNavActive('/learn/topics', '/learn/topics-archive')).toBe(false);
    expect(isNavActive('/sandbox', '/sandbox/attempts/abc')).toBe(true);
  });

  it('ignores a trailing slash, a query and a hash of the route', () => {
    expect(isNavActive('/learn/achievements', '/learn/achievements/')).toBe(true);
    expect(isNavActive('/learn/achievements', '/learn/achievements?tab=all')).toBe(true);
    expect(isNavActive('/learn/achievements', '/learn/achievements#top')).toBe(true);
  });
});

describe('tabItems', () => {
  it('keeps five items for the bottom bar, with home, topics and profile among them', () => {
    const tabs = tabItems();

    expect(tabs).toHaveLength(5);
    expect(tabs.map((t) => t.id)).toEqual(expect.arrayContaining(['home', 'topics', 'profile']));
  });
});


describe('fallbackLayout', () => {
  it('leaves a page that declares its own layout alone', () => {
    expect(fallbackLayout('/admin/users', 'admin', true)).toBeUndefined();
    expect(fallbackLayout('/', 'landing', false)).toBeUndefined();
    expect(fallbackLayout('/learn/orders', 'learner', true)).toBeUndefined();
  });

  it('gives the whole /learn area the learn shell, signed in or not, so no page has to wrap a layout itself', () => {
    expect(fallbackLayout('/learn', undefined, true)).toBe('learn');
    expect(fallbackLayout('/learn/topics', undefined, false)).toBe('learn');
    expect(fallbackLayout('/learn/topics/abc/detail', undefined, true)).toBe('learn');
    expect(fallbackLayout('/learn/profile/dashboard', undefined, true)).toBe('learn');
  });

  it('gives /my-learning the learning layout, its steps area the steps layout and the lesson pages the focus layout without a sidebar', () => {
    expect(fallbackLayout('/my-learning', undefined, true)).toBe('learning');
    expect(fallbackLayout('/my-learning/topics/abc', undefined, true)).toBe('learning');
    expect(fallbackLayout('/my-learning/mastery', undefined, true)).toBe('learning');
    expect(fallbackLayout('/my-learning/lessons/abc', undefined, false)).toBe('focus');
    expect(fallbackLayout('/my-learning/sub-topics/abc', undefined, true)).toBe('focus');
    expect(fallbackLayout('/my-learning/quizzes/abc', undefined, true)).toBe('focus');
    expect(fallbackLayout('/my-learning/lessons-archive', undefined, true)).toBe('learning');
    expect(fallbackLayout('/my-learning/steps', undefined, true)).toBe('steps');
    expect(fallbackLayout('/my-learning/steps/abc', undefined, true)).toBe('steps');
    expect(fallbackLayout('/my-learning/steps-archive', undefined, true)).toBe('learning');
  });

  it('gives every other page the learner shell when signed in and the public layout for guests', () => {
    expect(fallbackLayout('/wallet', undefined, true)).toBe('learner');
    expect(fallbackLayout('/career', undefined, true)).toBe('learner');
    expect(fallbackLayout('/creators/abc', undefined, false)).toBe('public');
  });

  it('does not mistake a sibling path for an area', () => {
    expect(fallbackLayout('/learning-tips', undefined, true)).toBe('learner');
    expect(fallbackLayout('/learner', undefined, false)).toBe('public');
    expect(fallbackLayout('/my-learning-extra', undefined, true)).toBe('learner');
  });
});
