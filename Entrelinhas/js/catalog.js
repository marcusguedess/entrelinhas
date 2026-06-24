const SAFE_ASSET_PATH = /^\.\/[a-zA-Z0-9_./-]+$/;
const TRANSCRIPT_EXTENSIONS = /\.(?:vtt|md)$/i;

function safeAssetPath(value) {
  if (value === null) return null;
  const path = String(value || '');
  return SAFE_ASSET_PATH.test(path) && !path.includes('..') ? path : null;
}

function parseChapter(value, index) {
  if (!value || typeof value !== 'object') return null;
  const number = Number(value.number);
  const id = String(value.id || '');
  if (!Number.isInteger(number) || number < 1 || !/^capitulo-\d{2,3}$/.test(id)) return null;
  const transcript = safeAssetPath(value.transcript);
  return {
    id,
    number,
    title: String(value.title || `Seção ${index + 1}`).slice(0, 100),
    audio: safeAssetPath(value.audio),
    transcript: transcript && TRANSCRIPT_EXTENSIONS.test(transcript) ? transcript : null,
    chapterStart: Number.isInteger(Number(value.chapterStart)) ? Number(value.chapterStart) : null,
    chapterEnd: Number.isInteger(Number(value.chapterEnd)) ? Number(value.chapterEnd) : null,
    durationSeconds: Number.isFinite(Number(value.durationSeconds))
      ? Number(value.durationSeconds)
      : null,
    durationLabel: String(value.durationLabel || '').slice(0, 24),
  };
}

export async function loadCatalog() {
  const response = await fetch('./data/catalog.json', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Catálogo indisponível (${response.status})`);
  const data = await response.json();
  if (!data || !Array.isArray(data.chapters)) throw new Error('Catálogo inválido');
  const chapters = data.chapters.map(parseChapter).filter(Boolean).slice(0, 200);
  if (!chapters.length) throw new Error('Nenhuma seção válida no catálogo');
  return chapters;
}
