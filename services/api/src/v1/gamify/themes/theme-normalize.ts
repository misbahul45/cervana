export interface ImageInput {
  fileId?: string;
  url?: string;
}

export type ImageLike = string | ImageInput | null | undefined;

export function normalizeThemeImage(input: ImageLike): { fileId?: string; url?: string } | null {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input === 'string') {
    if (input.trim() === '') return null;
    return { url: input };
  }
  const out: { fileId?: string; url?: string } = {};
  if (input.fileId && input.fileId.trim() !== '') {
    out.fileId = input.fileId;
  }
  if (input.url && input.url.trim() !== '') {
    out.url = input.url;
  }
  if (!out.fileId && !out.url) return null;
  return out;
}
