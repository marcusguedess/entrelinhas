const DB_NAME = 'entrelinhas-library';
const DB_VERSION = 1;
const STORE = 'books';
const MAX_FILES = 60;
const MAX_FILE_SIZE = 250 * 1024 * 1024;
const MAX_TRANSCRIPT_SIZE = 2 * 1024 * 1024;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction(storeMode, callback) {
  return openDatabase().then((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, storeMode);
      const store = tx.objectStore(STORE);
      const result = callback(store);
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    }),
  );
}

function sanitizeText(value, fallback) {
  const text = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return text || fallback;
}

function sortedAudioFiles(files) {
  return Array.from(files || [])
    .filter((file) => file.type.startsWith('audio/') && file.size > 0 && file.size <= MAX_FILE_SIZE)
    .slice(0, MAX_FILES)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
}

function normalizedStem(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/^0+(?=\d)/, '');
}

function transcriptFilesByStem(files) {
  const transcripts = new Map();
  Array.from(files || [])
    .filter((file) =>
      /\.(?:vtt|md)$/i.test(file.name) &&
      file.size > 0 &&
      file.size <= MAX_TRANSCRIPT_SIZE &&
      (file.type === '' || file.type === 'text/vtt' || file.type === 'text/markdown' || file.type === 'text/plain'),
    )
    .forEach((file) => transcripts.set(normalizedStem(file.name), file));
  return transcripts;
}

export async function saveLocalBook({ title, author, files }) {
  const audioFiles = sortedAudioFiles(files);
  if (!audioFiles.length) throw new Error('Selecione pelo menos um arquivo de áudio válido.');
  const transcripts = transcriptFilesByStem(files);
  const id = crypto.randomUUID();
  const book = {
    id,
    title: sanitizeText(title, 'Audiobook importado'),
    author: sanitizeText(author, 'Biblioteca local'),
    createdAt: new Date().toISOString(),
    chapters: audioFiles.map((file, index) => ({
      transcript: transcripts.get(normalizedStem(file.name)) || transcripts.get(String(index + 1)) || null,
      id: `local-${id}-${String(index + 1).padStart(3, '0')}`,
      number: index + 1,
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 100),
      name: file.name,
      type: file.type || 'audio/mpeg',
      blob: file,
    })),
  };
  await transaction('readwrite', (store) => store.put(book));
  return book;
}

export async function listLocalChapters() {
  const books = await transaction('readonly', (store) => {
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
  return books.flatMap((book) =>
    book.chapters.map((chapter) => ({
      id: chapter.id,
      number: chapter.number,
      title: `${book.title} · ${chapter.title}`,
      author: book.author,
      audio: URL.createObjectURL(chapter.blob),
      transcript: chapter.transcript ? URL.createObjectURL(chapter.transcript) : null,
      local: true,
    })),
  );
}
