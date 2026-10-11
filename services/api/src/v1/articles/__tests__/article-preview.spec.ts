import { PREVIEW_MAX_CHARACTERS, buildPreview, countWords, previewLimit, readingMinutes } from '../article-preview';

describe('countWords', () => {
  it('counts words separated by any whitespace', () => {
    expect(countWords('satu dua\ntiga\t empat')).toBe(4);
  });

  it('ignores markdown punctuation that is not a word', () => {
    expect(countWords('# Judul\n\n- satu\n- dua\n\n> kutipan ---')).toBe(4);
  });

  it('is zero for an empty or blank body', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  \n\n ')).toBe(0);
  });
});

describe('readingMinutes', () => {
  it('is at least one minute, even for a very short text', () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(40)).toBe(1);
  });

  it('rounds up at two hundred words per minute', () => {
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(201)).toBe(2);
    expect(readingMinutes(1000)).toBe(5);
  });
});

describe('buildPreview', () => {
  const paragraph = (label: string, size: number) => `${label} ${'kata '.repeat(size).trim()}.`;

  it('returns the whole body when it fits and says nothing was cut', () => {
    const result = buildPreview('Paragraf pendek.\n\nParagraf kedua.');

    expect(result.preview).toBe('Paragraf pendek.\n\nParagraf kedua.');
    expect(result.truncated).toBe(false);
  });

  it('stops at a paragraph boundary once the limit is reached', () => {
    const body = [paragraph('Satu', 40), paragraph('Dua', 40), paragraph('Tiga', 40), paragraph('Empat', 40)].join('\n\n');

    const result = buildPreview(body);

    expect(result.truncated).toBe(true);
    expect(result.preview.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARACTERS);
    expect(body.startsWith(result.preview)).toBe(true);
    expect(result.preview.endsWith('.')).toBe(true);
    expect(result.preview).not.toContain('Empat');
  });

  it('always shows at least the first paragraph, cut on a word boundary when it alone is too long', () => {
    const body = `${'kata '.repeat(400).trim()}.\n\nKedua.`;

    const result = buildPreview(body);

    expect(result.truncated).toBe(true);
    expect(result.preview.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARACTERS + 1);
    expect(result.preview.endsWith('…')).toBe(true);
    expect(result.preview).not.toContain('Kedua');
    expect(result.preview.slice(0, -1).trimEnd().endsWith('kata')).toBe(true);
  });

  it('never leaves a fenced code block open', () => {
    const body = ['Pengantar singkat.', '```ts\nconst a = 1;\n\nconst b = 2;\n```', paragraph('Penutup', 120)].join('\n\n');

    const result = buildPreview(body);
    const fences = result.preview.split('\n').filter((line) => line.trimStart().startsWith('```')).length;

    expect(fences % 2).toBe(0);
  });

  it('closes a code block that had to be cut', () => {
    const body = `\`\`\`ts\n${'const nilai = 1;\n'.repeat(200)}\`\`\``;

    const result = buildPreview(body);
    const fences = result.preview.split('\n').filter((line) => line.trimStart().startsWith('```')).length;

    expect(result.truncated).toBe(true);
    expect(fences % 2).toBe(0);
  });

  it('reports the length of the whole article, not of the preview', () => {
    const body = Array.from({ length: 30 }, (_, index) => paragraph(`P${index}`, 60)).join('\n\n');

    const result = buildPreview(body);

    expect(result.wordCount).toBe(countWords(body));
    expect(result.readingMinutes).toBe(readingMinutes(result.wordCount));
    expect(result.readingMinutes).toBeGreaterThan(1);
  });

  it('is empty for an empty body', () => {
    expect(buildPreview('')).toEqual({ preview: '', truncated: false, wordCount: 0, readingMinutes: 1 });
  });

  it('never returns text from beyond the limit even when the body has no blank lines at all', () => {
    const body = `${'a'.repeat(5000)}`;

    const result = buildPreview(body);

    expect(result.preview.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARACTERS + 1);
    expect(result.truncated).toBe(true);
  });
});

describe('previewLimit', () => {
  it('lets a free article show up to the standard limit', () => {
    expect(previewLimit('FREE', 100)).toBe(PREVIEW_MAX_CHARACTERS);
    expect(previewLimit('FREE', 5000)).toBe(PREVIEW_MAX_CHARACTERS);
  });

  it('never reveals more than half of a premium article, and never more than the standard limit', () => {
    expect(previewLimit('PAID', 400)).toBe(200);
    expect(previewLimit('PAID', 5000)).toBe(PREVIEW_MAX_CHARACTERS);
    expect(previewLimit('PAID', 1)).toBe(0);
  });
});

describe('buildPreview with a custom limit', () => {
  it('cuts a short body that would otherwise fit entirely', () => {
    const body = `${'kata '.repeat(80).trim()}.`;

    const result = buildPreview(body, previewLimit('PAID', body.length));

    expect(result.truncated).toBe(true);
    expect(result.preview.length).toBeLessThanOrEqual(Math.floor(body.length / 2) + 1);
    expect(result.preview.length).toBeLessThan(body.length);
  });

  it('shows nothing of a premium body of a single character', () => {
    const result = buildPreview('H', previewLimit('PAID', 1));

    expect(result.preview).toBe('');
    expect(result.truncated).toBe(true);
  });

  it('still reports the length of the whole article', () => {
    const body = Array.from({ length: 12 }, (_, index) => `Paragraf ${index} ${'kata '.repeat(50).trim()}.`).join('\n\n');

    const result = buildPreview(body, 100);

    expect(result.wordCount).toBe(countWords(body));
  });
});
