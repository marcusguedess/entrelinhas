const KEYS = Object.freeze({
  chapter: 'entrelinhas.chapter.v2',
  positions: 'entrelinhas.positions.v2',
  listening: 'entrelinhas.listening.v2',
  speed: 'entrelinhas.speed.v2',
  volume: 'entrelinhas.volume.v2',
  bookmarks: 'entrelinhas.bookmarks.v2',
  theme: 'entrelinhas.theme.v1',
  focus: 'entrelinhas.focus.v1',
  welcome: 'entrelinhas.welcome.v1',
  transcriptSize: 'entrelinhas.transcript-size.v1',
});

function isSafeId(id) {
  return /^[a-z0-9-]{3,90}$/i.test(String(id || ''));
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function getPlayerState() {
  const rawPositions = readJson(KEYS.positions, {});
  const positions = {};
  if (rawPositions && typeof rawPositions === 'object' && !Array.isArray(rawPositions)) {
    Object.entries(rawPositions).forEach(([id, value]) => {
      if (isSafeId(id)) positions[id] = finiteNumber(value);
    });
  }
  return {
    chapterId: String(localStorage.getItem(KEYS.chapter) || ''),
    positions,
    listening: readListening(),
    speed: Math.min(2, Math.max(0.75, finiteNumber(localStorage.getItem(KEYS.speed), 1))),
    volume: Math.min(1, Math.max(0, finiteNumber(localStorage.getItem(KEYS.volume), 1))),
  };
}

export function readListening() {
  const raw = readJson(KEYS.listening, {});
  const listening = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([id, value]) => {
      if (isSafeId(id)) listening[id] = finiteNumber(value);
    });
  }
  return listening;
}

export function saveChapter(id) {
  if (isSafeId(id)) localStorage.setItem(KEYS.chapter, id);
}

export function savePosition(id, seconds) {
  if (!isSafeId(id)) return;
  const positions = getPlayerState().positions;
  positions[id] = finiteNumber(seconds);
  localStorage.setItem(KEYS.positions, JSON.stringify(positions));
}

export function savePositions(values) {
  const positions = {};
  if (values && typeof values === 'object' && !Array.isArray(values)) {
    Object.entries(values).forEach(([id, value]) => {
      if (isSafeId(id)) positions[id] = finiteNumber(value);
    });
  }
  localStorage.setItem(KEYS.positions, JSON.stringify(positions));
  return positions;
}

export function removeChapterData(chapterIds) {
  const ids = new Set(Array.isArray(chapterIds) ? chapterIds.filter(isSafeId) : []);
  if (!ids.size) return;

  const positions = getPlayerState().positions;
  const listening = readListening();
  ids.forEach((id) => {
    delete positions[id];
    delete listening[id];
  });
  localStorage.setItem(KEYS.positions, JSON.stringify(positions));
  localStorage.setItem(KEYS.listening, JSON.stringify(listening));

  const bookmarks = loadBookmarks().filter((bookmark) => !ids.has(bookmark.chapterId));
  localStorage.setItem(KEYS.bookmarks, JSON.stringify(bookmarks));
  if (ids.has(localStorage.getItem(KEYS.chapter))) localStorage.removeItem(KEYS.chapter);
}

export function saveSpeed(speed) {
  const safeSpeed = Math.min(2, Math.max(0.75, finiteNumber(speed, 1)));
  localStorage.setItem(KEYS.speed, String(safeSpeed));
}

export function saveVolume(volume) {
  const safeVolume = Math.min(1, Math.max(0, finiteNumber(volume, 1)));
  localStorage.setItem(KEYS.volume, String(safeVolume));
}

export function loadPreference(key, fallback = '') {
  if (!['theme', 'focus', 'welcome', 'transcriptSize'].includes(key)) return fallback;
  return localStorage.getItem(KEYS[key]) || fallback;
}

export function savePreference(key, value) {
  if (!['theme', 'focus', 'welcome', 'transcriptSize'].includes(key)) return;
  localStorage.setItem(KEYS[key], String(value));
}

export function addListeningTime(id, seconds) {
  if (!isSafeId(id)) return 0;
  const listening = readListening();
  listening[id] = finiteNumber(listening[id]) + Math.min(10, Math.max(0, finiteNumber(seconds)));
  localStorage.setItem(KEYS.listening, JSON.stringify(listening));
  return listening[id];
}

export function validateBookmark(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const chapterId = String(value.chapterId || '');
  if (!isSafeId(chapterId)) return null;
  return {
    id:
      typeof value.id === 'string' && /^[a-f0-9-]{16,64}$/i.test(value.id)
        ? value.id
        : crypto.randomUUID(),
    chapterId,
    time: finiteNumber(value.time),
    note: String(value.note || '')
      .trim()
      .slice(0, 120),
    createdAt: /^\d{4}-\d{2}-\d{2}T/.test(String(value.createdAt || ''))
      ? String(value.createdAt)
      : new Date().toISOString(),
  };
}

export function loadBookmarks() {
  const raw = readJson(KEYS.bookmarks, []);
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map(validateBookmark).filter(Boolean);
}

export function saveBookmarks(bookmarks) {
  const safe = Array.isArray(bookmarks)
    ? bookmarks.slice(0, 200).map(validateBookmark).filter(Boolean)
    : [];
  localStorage.setItem(KEYS.bookmarks, JSON.stringify(safe));
  return safe;
}
