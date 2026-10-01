export function parseOrigins(input: string | undefined | null): string[] {
  if (!input) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of input.split(',')) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      continue;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      continue;
    }

    if (seen.has(url.origin)) {
      continue;
    }

    seen.add(url.origin);
    result.push(url.origin);
  }

  return result;
}
