function timestampToSeconds(value) {
  const parts = value.replace(',', '.').split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export function parseVtt(source) {
  if (typeof source !== 'string' || source.length > 1_000_000) return [];
  const blocks = source.replace(/^\uFEFF/, '').split(/\r?\n\r?\n/);
  return blocks.flatMap((block) => {
    const lines = block.split(/\r?\n/).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) return [];
    const [rawStart, rawEnd] = lines[timingIndex]
      .split('-->')
      .map((part) => part.trim().split(/\s+/)[0]);
    const start = timestampToSeconds(rawStart);
    const end = timestampToSeconds(rawEnd);
    const text = lines
      .slice(timingIndex + 1)
      .join(' ')
      .replace(/<[^>]*>/g, '')
      .trim();
    if (start === null || end === null || end <= start || !text) return [];
    return [{ start, end, text: text.slice(0, 1000) }];
  });
}

function stripMarkdown(value) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~>#-]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseMarkdown(source) {
  if (typeof source !== 'string' || source.length > 1_000_000) return [];
  return source
    .split(/\r?\n\r?\n+/)
    .map(stripMarkdown)
    .filter(Boolean)
    .slice(0, 300)
    .map((text) => ({
      start: 0,
      end: Number.POSITIVE_INFINITY,
      text: text.slice(0, 1000),
      untimed: true,
    }));
}

export async function loadTranscript(path, kind = '') {
  if (!path) return [];
  const response = await fetch(path, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Transcrição indisponível (${response.status})`);
  const source = await response.text();
  return kind === 'markdown' || /\.md(?:$|[?#])/i.test(path)
    ? parseMarkdown(source)
    : parseVtt(source);
}
