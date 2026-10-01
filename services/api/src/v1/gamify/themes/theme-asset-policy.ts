export interface ThemeAssetAcceptInput {
  url: string;
  declaredSize?: number;
  declaredMime?: string;
}

export interface ThemeAssetPolicyOptions {
  allowedHosts?: ReadonlyArray<string>;
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;

const PRIVATE_IPV4_PATTERNS: ReadonlyArray<RegExp> = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

const LOOPBACK_HOSTS = new Set(['localhost', '::1', '[::1]']);
const METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata',
]);

function isDecimalOrHexIPv4(host: string): boolean {
  if (/^\d+$/.test(host)) {
    const asNumber = Number(host);
    if (!Number.isFinite(asNumber) || asNumber < 0 || asNumber > 0xffffffff) {
      return false;
    }
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(asNumber);
    const octets = [buf[0] ?? 0, buf[1] ?? 0, buf[2] ?? 0, buf[3] ?? 0];
    return octets.every((o) => o >= 0 && o <= 255);
  }
  return false;
}

function hostPathEndsWithSvg(parsed: URL): boolean {
  const path = parsed.pathname.toLowerCase();
  return path.endsWith('.svg') || path.includes('.svg?');
}

function isPrivateOrLinkLocalIPv4(host: string): boolean {
  if (isDecimalOrHexIPv4(host)) {
    return true;
  }
  return PRIVATE_IPV4_PATTERNS.some((re) => re.test(host));
}

export function acceptThemeAsset(
  input: ThemeAssetAcceptInput,
  options: ThemeAssetPolicyOptions = {},
): { accepted: boolean; reason?: string; origin?: string } {
  const { url, declaredSize, declaredMime } = input;
  const allowedHosts = options.allowedHosts ?? [];
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (declaredSize !== undefined && declaredSize > maxBytes) {
    return { accepted: false, reason: `declared size ${declaredSize} exceeds max ${maxBytes}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { accepted: false, reason: 'invalid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { accepted: false, reason: `protocol ${parsed.protocol} not allowed` };
  }

  if (parsed.username || parsed.password) {
    return { accepted: false, reason: 'userinfo in URL not allowed' };
  }

  if (parsed.port && parsed.port !== '443') {
    return { accepted: false, reason: `non-https port ${parsed.port} not allowed` };
  }

  const host = parsed.hostname.toLowerCase();
  const trailingDot = host.endsWith('.');
  if (trailingDot) {
    return { accepted: false, reason: 'trailing dot in host not allowed' };
  }

  if (LOOPBACK_HOSTS.has(host) || METADATA_HOSTS.has(host) || host === '0.0.0.0') {
    return { accepted: false, reason: `host ${host} blocked` };
  }

  if (isPrivateOrLinkLocalIPv4(host)) {
    return { accepted: false, reason: `private or link-local host ${host} blocked` };
  }

  if (declaredMime === 'image/svg+xml' || hostPathEndsWithSvg(parsed)) {
    return { accepted: false, reason: 'remote SVG content not allowed' };
  }

  if (!allowedHosts.includes(host)) {
    return { accepted: false, reason: `host ${host} not in allow-list` };
  }

  return { accepted: true, origin: parsed.origin };
}
