import { normalizeThemeImage } from '../theme-normalize';

describe('normalizeThemeImage', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normalizeThemeImage(null)).toBeNull();
    expect(normalizeThemeImage(undefined)).toBeNull();
    expect(normalizeThemeImage('')).toBeNull();
    expect(normalizeThemeImage('   ')).toBeNull();
  });

  it('converts a URL string into { url }', () => {
    expect(normalizeThemeImage('https://cdn.example.com/icon.png')).toEqual({
      url: 'https://cdn.example.com/icon.png',
    });
  });

  it('keeps an object and prefers url', () => {
    expect(
      normalizeThemeImage({ fileId: 'abc', url: 'https://cdn.example.com/x.png' }),
    ).toEqual({ fileId: 'abc', url: 'https://cdn.example.com/x.png' });
  });

  it('drops empty fileId/url and returns null when both are empty', () => {
    expect(normalizeThemeImage({ fileId: '', url: '   ' })).toBeNull();
  });

  it('keeps fileId-only when url is missing', () => {
    expect(normalizeThemeImage({ fileId: 'abc' })).toEqual({ fileId: 'abc' });
  });
});
