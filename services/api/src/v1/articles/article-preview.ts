export const PREVIEW_MAX_CHARACTERS = 600;
const WORDS_PER_MINUTE = 200;
const FENCE = '```';

export interface ArticlePreview {
  preview: string;
  truncated: boolean;
  wordCount: number;
  readingMinutes: number;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

const isFence = (line: string) => line.trimStart().startsWith(FENCE);

function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let insideFence = false;
  for (const line of text.split('\n')) {
    if (isFence(line)) insideFence = !insideFence;
    if (!insideFence && line.trim() === '') {
      if (current.length) blocks.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

function cutOnWord(block: string, limit: number): string {
  const head = block.slice(0, limit);
  const boundary = head.search(/\s\S*$/);
  const cut = (boundary > 0 ? head.slice(0, boundary) : head).trimEnd();
  const open = cut.split('\n').filter(isFence).length % 2 === 1;
  return `${cut}…${open ? `\n${FENCE}` : ''}`;
}

export function previewLimit(accessType: 'FREE' | 'PAID', contentLength: number): number {
  if (accessType === 'FREE') return PREVIEW_MAX_CHARACTERS;
  return Math.min(PREVIEW_MAX_CHARACTERS, Math.floor(contentLength / 2));
}

export function buildPreview(content: string, limit: number = PREVIEW_MAX_CHARACTERS): ArticlePreview {
  const text = content.replace(/\r\n?/g, '\n').trim();
  const wordCount = countWords(text);
  if (limit <= 0) {
    return { preview: '', truncated: text.length > 0, wordCount, readingMinutes: readingMinutes(wordCount) };
  }
  const blocks = splitBlocks(text);
  const included: string[] = [];
  let length = 0;
  let truncated = false;

  for (const block of blocks) {
    const next = length + block.length + (included.length ? 2 : 0);
    if (included.length === 0 && block.length > limit) {
      included.push(cutOnWord(block, limit));
      truncated = true;
      break;
    }
    if (next > limit) {
      truncated = true;
      break;
    }
    included.push(block);
    length = next;
  }

  return { preview: included.join('\n\n'), truncated, wordCount, readingMinutes: readingMinutes(wordCount) };
}
