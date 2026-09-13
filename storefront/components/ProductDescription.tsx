import type { ReactNode } from 'react';

const ENTITIES: Record<string, string> = {
  amp: '&', apos: "'", gt: '>', hellip: '…', lt: '<', mdash: '—', nbsp: ' ', ndash: '–', quot: '"',
};

export function decodeProductEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? entity;
    const numeric = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return Number.isFinite(numeric) && numeric >= 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : entity;
  });
}

function safeDescriptionHref(raw: string): string | null {
  const value = decodeProductEntities(raw.trim());
  if (/[\\\u0000-\u001f\u007f]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function plainText(value: string): string {
  return decodeProductEntities(value.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function textChunk(value: string): string {
  return decodeProductEntities(value.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ');
}

function inlineContent(value: string, keyPrefix: string): ReactNode[] {
  const output: ReactNode[] = [];
  const link = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = link.exec(value))) {
    const before = textChunk(value.slice(cursor, match.index));
    if (before) output.push(before);
    const label = plainText(match[3]);
    const href = safeDescriptionHref(match[2]);
    if (label) output.push(href
      ? <a key={`${keyPrefix}-${match.index}`} href={href} target={href.startsWith('/') ? undefined : '_blank'} rel={href.startsWith('/') ? undefined : 'noopener noreferrer'}>{label}</a>
      : label);
    cursor = match.index + match[0].length;
  }
  const after = textChunk(value.slice(cursor));
  if (after) output.push(after);
  return output;
}

export default function ProductDescription({ html }: { html: string }) {
  const safeSource = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n');
  const blocks: ReactNode[] = [];
  const block = /<(h[2-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  let cursor = 0;
  const appendLooseText = (value: string) => {
    const content = inlineContent(value, `description-loose-${index}`);
    if (content.some((node) => typeof node !== 'string' || node.trim())) blocks.push(<p key={`description-${index++}`}>{content}</p>);
  };
  while ((match = block.exec(safeSource))) {
    appendLooseText(safeSource.slice(cursor, match.index));
    const content = inlineContent(match[2], `description-${index}`);
    if (content.some((node) => typeof node !== 'string' || node.trim())) {
      const key = `description-${index++}`;
      if (match[1] === 'p') blocks.push(<p key={key}>{content}</p>);
      else if (match[1] === 'li') blocks.push(<ul key={key}><li>{content}</li></ul>);
      else {
        const level = Number(match[1].slice(1));
        if (level === 2) blocks.push(<h2 key={key}>{content}</h2>);
        else if (level === 3) blocks.push(<h3 key={key}>{content}</h3>);
        else if (level === 4) blocks.push(<h4 key={key}>{content}</h4>);
        else if (level === 5) blocks.push(<h5 key={key}>{content}</h5>);
        else blocks.push(<h6 key={key}>{content}</h6>);
      }
    }
    cursor = match.index + match[0].length;
  }
  appendLooseText(safeSource.slice(cursor));
  return <div className="prose-ecl">{blocks}</div>;
}
