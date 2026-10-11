import { describe, expect, it } from 'vitest';
import { AUTH_PITCHES, authPitch } from '~/lib/auth-pitch';

describe('authPitch', () => {
  it('has a pitch for each auth page, each with its own headline and body', () => {
    const paths = ['/login', '/register', '/forgot-password', '/verify-email'];
    const headlines = paths.map((path) => authPitch(path).accent);

    expect(new Set(headlines).size).toBe(paths.length);
    for (const path of paths) {
      const pitch = authPitch(path);
      expect(pitch.lead.length + pitch.accent.length).toBeGreaterThan(0);
      expect(pitch.accent.length).toBeGreaterThan(0);
      expect(pitch.body.length).toBeGreaterThan(40);
    }
  });

  it('ignores a trailing slash and a query string', () => {
    expect(authPitch('/login/')).toBe(authPitch('/login'));
    expect(authPitch('/login?reset=1')).toBe(authPitch('/login'));
  });

  it('falls back to the registration pitch for any other path', () => {
    expect(authPitch('/somewhere-else')).toBe(AUTH_PITCHES['/register']);
  });

  it('never promises anything the product does not do', () => {
    const text = Object.values(AUTH_PITCHES)
      .map((pitch) => `${pitch.lead} ${pitch.accent} ${pitch.tail} ${pitch.body}`)
      .join(' ')
      .toLowerCase();

    for (const banned of ['beli', 'gratis selamanya', 'jaminan', 'dijamin', 'nyawa', 'misi harian']) {
      expect(text).not.toContain(banned);
    }
  });
});
