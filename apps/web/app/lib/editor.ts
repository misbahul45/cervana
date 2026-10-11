export interface EditResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): EditResult {
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.min(text.length, Math.max(start, end));
  const selected = text.slice(from, to) || placeholder;
  const next = `${text.slice(0, from)}${before}${selected}${after}${text.slice(to)}`;
  const selectionStart = from + before.length;
  return { text: next, selectionStart, selectionEnd: selectionStart + selected.length };
}

export function prefixLines(text: string, start: number, end: number, prefix: string | ((index: number) => string)): EditResult {
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.min(text.length, Math.max(start, end));
  const lineStart = text.lastIndexOf('\n', from - 1) + 1;
  const lineEndIndex = text.indexOf('\n', to);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n').map((line, index) => `${typeof prefix === 'function' ? prefix(index) : prefix}${line}`);
  const replaced = lines.join('\n');
  return {
    text: `${text.slice(0, lineStart)}${replaced}${text.slice(lineEnd)}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + replaced.length,
  };
}

export function insertBlock(text: string, position: number, block: string): EditResult {
  const at = Math.max(0, Math.min(position, text.length));
  const lead = at === 0 || text.slice(0, at).endsWith('\n\n') ? '' : text.slice(0, at).endsWith('\n') ? '\n' : '\n\n';
  const tail = text.slice(at).startsWith('\n') ? '' : '\n';
  const inserted = `${lead}${block}${tail}`;
  const next = `${text.slice(0, at)}${inserted}${text.slice(at)}`;
  const caret = at + inserted.length;
  return { text: next, selectionStart: caret, selectionEnd: caret };
}
