import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

export const renderMarkdown = (text: string | null | undefined): string => (text ? md.render(text) : '');
