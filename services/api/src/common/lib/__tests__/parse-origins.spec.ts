import { parseOrigins } from '../parse-origins';

describe('parseOrigins', () => {
  it('returns [] for undefined', () => {
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('returns [] for null', () => {
    expect(parseOrigins(null)).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(parseOrigins('')).toEqual([]);
  });

  it('returns [] for whitespace only', () => {
    expect(parseOrigins('   ')).toEqual([]);
  });

  it('returns [] for only commas', () => {
    expect(parseOrigins(',,,')).toEqual([]);
  });

  it('parses a single origin', () => {
    expect(parseOrigins('https://a.com')).toEqual(['https://a.com']);
  });

  it('parses comma-separated origins', () => {
    expect(parseOrigins('https://a.com,https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('trims whitespace around entries', () => {
    expect(parseOrigins('  https://a.com , https://b.com  ')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('drops empty entries between commas', () => {
    expect(parseOrigins('https://a.com,,https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('strips path from URL and returns canonical origin', () => {
    expect(parseOrigins('https://a.com/path?q=1')).toEqual(['https://a.com']);
  });

  it('drops invalid URLs', () => {
    expect(parseOrigins('not-a-url,https://a.com')).toEqual(['https://a.com']);
  });

  it('drops non-http(s) URLs', () => {
    expect(
      parseOrigins('ftp://a.com,https://b.com,file:///etc/passwd,javascript:alert(1)'),
    ).toEqual(['https://b.com']);
  });

  it('dedupes repeated origins', () => {
    expect(parseOrigins('https://a.com,https://a.com')).toEqual(['https://a.com']);
  });

  it('preserves port in the canonical origin', () => {
    expect(parseOrigins('http://localhost:3001,http://localhost:3002')).toEqual([
      'http://localhost:3001',
      'http://localhost:3002',
    ]);
  });
});
