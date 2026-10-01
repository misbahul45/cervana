import { acceptThemeAsset } from '../theme-asset-policy';

const HOSTS = ['cdn.reducera.example.com'];

describe('theme asset policy', () => {
  describe('rejects dangerous inputs', () => {
    it.each([
      ['localhost', 'https://localhost/icon.png'],
      ['127.0.0.1', 'https://127.0.0.1/icon.png'],
      ['IPv6 loopback', 'https://[::1]/icon.png'],
      ['private 10.', 'https://10.0.0.5/icon.png'],
      ['private 192.168.', 'https://192.168.1.1/icon.png'],
      ['private 172.16.', 'https://172.16.0.1/icon.png'],
      ['link-local 169.254', 'https://169.254.169.254/icon.png'],
      ['metadata.google.internal', 'https://metadata.google.internal/icon.png'],
      ['AWS metadata decimal IPv4', 'https://2852039166/icon.png'],
      ['non-https protocol', 'http://cdn.reducera.example.com/icon.png'],
      ['ftp protocol', 'ftp://cdn.reducera.example.com/icon.png'],
      ['file protocol', 'file:///etc/passwd'],
      ['javascript: scheme', 'javascript:alert(1)'],
      ['userinfo in URL', 'https://user:pass@cdn.reducera.example.com/icon.png'],
      ['non-https port', 'https://cdn.reducera.example.com:8443/icon.png'],
      ['trailing-dot host', 'https://cdn.reducera.example.com./icon.png'],
      ['remote SVG', 'https://cdn.reducera.example.com/icon.svg'],
      ['oversize declared size', { url: 'https://cdn.reducera.example.com/icon.png', declaredSize: 8 * 1024 * 1024 }],
      ['host not in allow-list', 'https://evil.example.com/icon.png'],
      ['invalid URL', 'not-a-url'],
    ])('%s', (_name, url) => {
      const input = typeof url === 'string' ? { url } : url;
      const result = acceptThemeAsset(input, { allowedHosts: HOSTS });
      expect(result.accepted).toBe(false);
    });
  });

  describe('accepts safe inputs', () => {
    it('accepts an https asset on an allowed host', () => {
      const result = acceptThemeAsset(
        { url: 'https://cdn.reducera.example.com/icons/mark.png' },
        { allowedHosts: HOSTS },
      );
      expect(result.accepted).toBe(true);
      expect(result.origin).toBe('https://cdn.reducera.example.com');
    });

    it('accepts when declared size is within the limit', () => {
      const result = acceptThemeAsset(
        { url: 'https://cdn.reducera.example.com/icon.png', declaredSize: 1024 * 1024 },
        { allowedHosts: HOSTS, maxBytes: 4 * 1024 * 1024 },
      );
      expect(result.accepted).toBe(true);
    });
  });

  describe('does not make network calls', () => {
    it('returns synchronously without a fetch', () => {
      const start = Date.now();
      const result = acceptThemeAsset(
        { url: 'https://cdn.reducera.example.com/icon.png' },
        { allowedHosts: HOSTS },
      );
      expect(result.accepted).toBe(true);
      expect(Date.now() - start).toBeLessThan(50);
    });
  });
});
