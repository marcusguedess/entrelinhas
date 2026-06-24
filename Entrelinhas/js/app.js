import { loadCatalog } from './catalog.js';
import { deleteLocalBook, listLocalBooks, listLocalChapters, saveLocalBook } from './library.js';
import { loadTranscript } from './transcript.js';
import {
  addListeningTime,
  getPlayerState,
  loadPreference,
  loadBookmarks,
  readListening,
  removeChapterData,
  saveBookmarks,
  saveChapter,
  savePreference,
  savePositions,
  saveSpeed,
  saveVolume,
} from './storage.js';

const elements = Object.freeze({
  audio: document.getElementById('audio'),
  title: document.getElementById('chapter-title'),
  status: document.getElementById('player-status'),
  bookContext: document.getElementById('book-context'),
  listeningTime: document.getElementById('listening-time'),
  progress: document.getElementById('progress'),
  currentTime: document.getElementById('current-time'),
  duration: document.getElementById('duration'),
  sectionPosition: document.getElementById('section-position'),
  sectionRange: document.getElementById('section-range'),
  resumePoint: document.getElementById('resume-point'),
  sectionDuration: document.getElementById('section-duration'),
  transcriptState: document.getElementById('transcript-state'),
  previous: document.getElementById('previous'),
  backward: document.getElementById('backward'),
  play: document.getElementById('play'),
  forward: document.getElementById('forward'),
  next: document.getElementById('next'),
  speed: document.getElementById('speed'),
  volume: document.getElementById('volume'),
  volumeLabel: document.getElementById('volume-label'),
  mute: document.getElementById('mute'),
  download: document.getElementById('download'),
  focusMode: document.getElementById('focus-mode'),
  helpOpen: document.getElementById('help-open'),
  helpDialog: document.getElementById('help-dialog'),
  helpClose: document.getElementById('help-close'),
  themeToggle: document.getElementById('theme-toggle'),
  visual: document.getElementById('sound-visual'),
  chapterList: document.getElementById('chapter-list'),
  transcript: document.getElementById('transcript'),
  transcriptSearch: document.getElementById('transcript-search'),
  transcriptSmaller: document.getElementById('transcript-smaller'),
  transcriptLarger: document.getElementById('transcript-larger'),
  transcriptFollow: document.getElementById('transcript-follow'),
  completion: document.getElementById('completion'),
  bookmarkForm: document.getElementById('bookmark-form'),
  bookmarkNote: document.getElementById('bookmark-note'),
  bookmarkList: document.getElementById('bookmark-list'),
  exportBookmarks: document.getElementById('export-bookmarks'),
  importBookmarks: document.getElementById('import-bookmarks'),
  libraryForm: document.getElementById('library-form'),
  libraryTitle: document.getElementById('library-title'),
  libraryAuthor: document.getElementById('library-author'),
  libraryFiles: document.getElementById('library-files'),
  importPreview: document.getElementById('import-preview'),
  importSummary: document.getElementById('import-summary'),
  importFileList: document.getElementById('import-file-list'),
  localBookList: document.getElementById('local-book-list'),
  libraryStorage: document.getElementById('library-storage'),
  browserStorage: document.getElementById('browser-storage'),
  storagePersistence: document.getElementById('storage-persistence'),
  refreshStorage: document.getElementById('refresh-storage'),
  miniPlayer: document.getElementById('mini-player'),
  miniPlayerOpen: document.getElementById('mini-player-open'),
  miniCoverImage: document.getElementById('mini-cover-image'),
  miniTitle: document.getElementById('mini-title'),
  miniTime: document.getElementById('mini-time'),
  miniProgressValue: document.getElementById('mini-progress-value'),
  miniBackward: document.getElementById('mini-backward'),
  miniPlay: document.getElementById('mini-play'),
  miniForward: document.getElementById('mini-forward'),
  install: document.getElementById('install-app'),
  toast: document.getElementById('toast'),
  welcomeDialog: document.getElementById('welcome-dialog'),
  welcomeSample: document.getElementById('welcome-sample'),
  welcomeImport: document.getElementById('welcome-import'),
  welcomeSkip: document.getElementById('welcome-skip'),
  transcriptGuide: document.getElementById('transcript-guide'),
  transcriptGuideOpen: document.getElementById('transcript-guide-open'),
  transcriptGuideInline: document.getElementById('transcript-guide-inline'),
  transcriptGuideClose: document.getElementById('transcript-guide-close'),
});

const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const state = {
  chapters: [],
  index: 0,
  cues: [],
  speech: null,
  speechPosition: 0,
  speechTimer: null,
  deferredInstall: null,
  bookmarks: loadBookmarks(),
  listeningTicker: null,
  lastActiveCue: null,
  transcriptAutoscroll: true,
  localBooks: [],
  positions: {},
  lastPositionSavedAt: 0,
  listeningTicks: 0,
  offlineRequestId: null,
  transcriptSize: 1,
  offlineTimer: null,
  playerVisited: false,
};

function applyTheme(theme) {
  const resolved = theme === 'dark' || theme === 'light' ? theme : prefersDark ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolved;
  elements.themeToggle.setAttribute(
    'aria-label',
    resolved === 'dark' ? 'Ativar modo claro' : 'Ativar modo noturno'
  );
  elements.themeToggle.setAttribute('aria-pressed', String(resolved === 'dark'));
  elements.themeToggle.querySelector('span').textContent = resolved === 'dark' ? '☀' : '☾';
  savePreference('theme', resolved);
}

function applyFocusMode(enabled) {
  document.body.classList.toggle('focus-mode', enabled);
  elements.focusMode.setAttribute('aria-pressed', String(enabled));
  elements.focusMode.textContent = enabled ? 'Sair do modo escuta' : 'Modo escuta';
  savePreference('focus', enabled ? 'on' : 'off');
}

function applyTranscriptSize(value) {
  const safe = Math.min(1.35, Math.max(0.85, Number(value) || 1));
  state.transcriptSize = safe;
  elements.transcript.style.setProperty('--transcript-scale', String(safe));
  savePreference('transcriptSize', safe);
}

function openHelp() {
  if (typeof elements.helpDialog.showModal === 'function') {
    elements.helpDialog.showModal();
    elements.helpClose.focus();
  }
}

function closeHelp() {
  elements.helpDialog.close();
  elements.helpOpen.focus();
}

function closeWelcome(targetId = '') {
  savePreference('welcome', 'seen');
  if (elements.welcomeDialog.open) elements.welcomeDialog.close();
  if (targetId) {
    document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

function openTranscriptGuide() {
  if (typeof elements.transcriptGuide.showModal === 'function') {
    elements.transcriptGuide.showModal();
    elements.transcriptGuideClose.focus();
  }
}

function closeTranscriptGuide() {
  if (elements.transcriptGuide.open) elements.transcriptGuide.close();
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = String(safe % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

function formatBytes(bytes) {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (!safe) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(safe) / Math.log(1024)), units.length - 1);
  const value = safe / 1024 ** index;
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: index > 2 ? 1 : 0 })} ${
    units[index]
  }`;
}

function notify(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 3500);
}

function audioErrorMessage(error) {
  const mediaError = elements.audio.error;
  if (error?.name === 'NotAllowedError') {
    return 'O navegador bloqueou a reprodução. Clique novamente em Reproduzir e verifique se a aba não está silenciada.';
  }
  if (error?.name === 'NotSupportedError' || mediaError?.code === 4) {
    return 'O navegador não conseguiu ler este arquivo de áudio. Verifique o formato do MP3.';
  }
  if (mediaError?.code === 2) {
    return 'O áudio não pôde ser baixado do servidor local. Recarregue a página e confira se o localhost ainda está ativo.';
  }
  if (mediaError?.code === 3) {
    return 'O arquivo de áudio foi encontrado, mas o navegador não conseguiu decodificá-lo.';
  }
  return 'Não foi possível iniciar o áudio. Recarregue a página; se persistir, limpe os dados do site localhost.';
}

function currentChapter() {
  return state.chapters[state.index];
}
function currentChapterIndices() {
  const chapter = currentChapter();
  if (!chapter) return [];
  return state.chapters
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      chapter.bookId ? item.bookId === chapter.bookId : !item.bookId && !item.local
    )
    .map(({ index }) => index);
}
function currentPosition() {
  return currentChapter()?.audio ? elements.audio.currentTime : state.speechPosition;
}
function estimatedSpeechDuration() {
  const words = state.cues.reduce((total, cue) => total + cue.text.split(/\s+/).length, 0);
  return words ? (words / (150 * Number(elements.speed.value))) * 60 : 0;
}

function setPlaying(playing) {
  elements.play.textContent = playing ? '❚❚' : '▶';
  elements.play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir');
  elements.play.setAttribute('aria-pressed', String(playing));
  elements.visual.classList.toggle('active', playing);
  elements.miniPlay.textContent = playing ? '❚❚' : '▶';
  elements.miniPlay.setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir');
}

function setVolume(volume) {
  const safeVolume = Math.min(1, Math.max(0, Number(volume)));
  elements.audio.volume = safeVolume;
  elements.volume.value = String(safeVolume);
  elements.volumeLabel.textContent = `Volume ${Math.round(safeVolume * 100)}%`;
  elements.mute.textContent = safeVolume === 0 ? 'Ativar som' : 'Silenciar';
  elements.mute.setAttribute('aria-pressed', String(safeVolume === 0));
  saveVolume(safeVolume);
}

function stopSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  window.clearInterval(state.speechTimer);
  state.speechTimer = null;
  state.speech = null;
}

function updateProgress(position, duration) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const percent = safeDuration ? Math.min(100, (position / safeDuration) * 100) : 0;
  elements.progress.value = String(percent);
  elements.currentTime.textContent = formatTime(position);
  elements.duration.textContent = formatTime(safeDuration);
  elements.resumePoint.textContent = formatTime(position);
  elements.miniTime.textContent = `${formatTime(position)} de ${formatTime(safeDuration)}`;
  elements.miniProgressValue.style.width = `${percent}%`;
  const chapter = currentChapter();
  if (chapter) {
    state.positions[chapter.id] = Number.isFinite(position) ? Math.max(0, position) : 0;
    persistPositions();
  }
  highlightCue(position);
  renderCompletion();
}

function persistPositions(force = false) {
  const now = Date.now();
  if (!force && now - state.lastPositionSavedAt < 5000) return;
  state.positions = savePositions(state.positions);
  state.lastPositionSavedAt = now;
}

function highlightCue(position) {
  let activeCue = null;
  elements.transcript.querySelectorAll('.cue').forEach((button) => {
    if (button.dataset.untimed === 'true') return;
    const active =
      position >= Number(button.dataset.start) && position < Number(button.dataset.end);
    button.classList.toggle('active', active);
    if (active) {
      button.setAttribute('aria-current', 'true');
      activeCue = button;
    } else button.removeAttribute('aria-current');
  });
  if (activeCue && activeCue !== state.lastActiveCue && state.transcriptAutoscroll && isPlaying()) {
    activeCue.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    state.lastActiveCue = activeCue;
  }
}

function startSpeech(position = state.speechPosition) {
  if (!('speechSynthesis' in window) || !state.cues.length) {
    notify('Esta seção ainda não possui áudio ou transcrição narrável.');
    return;
  }
  stopSpeech();
  const duration = estimatedSpeechDuration();
  const startPercent = duration ? Math.min(1, position / duration) : 0;
  const allText = state.cues.map((cue) => cue.text).join(' ');
  const startAt = Math.floor(allText.length * startPercent);
  const utterance = new SpeechSynthesisUtterance(allText.slice(startAt));
  utterance.lang = 'pt-BR';
  utterance.rate = Number(elements.speed.value);
  utterance.volume = Number(elements.volume.value);
  utterance.onend = () => {
    setPlaying(false);
    window.clearInterval(state.speechTimer);
  };
  utterance.onerror = () => {
    setPlaying(false);
    notify('Não foi possível usar a voz do navegador.');
  };
  state.speech = utterance;
  state.speechPosition = position;
  window.speechSynthesis.speak(utterance);
  state.speechTimer = window.setInterval(() => {
    state.speechPosition = Math.min(duration, state.speechPosition + 0.25);
    updateProgress(state.speechPosition, duration);
  }, 250);
  setPlaying(true);
  elements.status.textContent = 'Narração pela voz do navegador';
}

async function togglePlayback() {
  const chapter = currentChapter();
  if (!chapter) return;
  if (chapter.audio) {
    if (elements.audio.paused) {
      try {
        await elements.audio.play();
      } catch (error) {
        notify(audioErrorMessage(error));
      }
    } else elements.audio.pause();
    return;
  }
  if (state.speech && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
    window.clearInterval(state.speechTimer);
    setPlaying(false);
  } else if (state.speech && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    setPlaying(true);
  } else startSpeech();
}

function isPlaying() {
  if (currentChapter()?.audio) return !elements.audio.paused && !elements.audio.ended;
  return Boolean(state.speech) && !window.speechSynthesis.paused;
}

function renderListeningTime() {
  const chapter = currentChapter();
  const seconds = chapter ? readListening()[chapter.id] || 0 : 0;
  elements.listeningTime.textContent = `Tempo ouvido nesta seção: ${formatTime(seconds)}`;
}

function startListeningTicker() {
  window.clearInterval(state.listeningTicker);
  state.listeningTicker = window.setInterval(() => {
    const chapter = currentChapter();
    if (!chapter || document.hidden || !isPlaying()) return;
    addListeningTime(chapter.id, 1);
    renderListeningTime();
    state.listeningTicks += 1;
    if (state.listeningTicks % 15 === 0) renderChapters();
  }, 1000);
}

function seekTo(seconds) {
  const chapter = currentChapter();
  if (!chapter) return;
  if (chapter.audio)
    elements.audio.currentTime = Math.max(0, Math.min(elements.audio.duration || 0, seconds));
  else {
    state.speechPosition = Math.max(0, Math.min(estimatedSpeechDuration(), seconds));
    if (state.speech) startSpeech(state.speechPosition);
    else updateProgress(state.speechPosition, estimatedSpeechDuration());
  }
}

function renderTranscript() {
  elements.transcript.replaceChildren();
  state.lastActiveCue = null;
  const query = elements.transcriptSearch.value.trim().toLocaleLowerCase('pt-BR');
  if (!state.cues.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Esta faixa não possui transcrição. Você ainda pode ouvi-la normalmente.';
    elements.transcript.append(empty);
    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'text-button';
    help.textContent = 'Como adicionar uma transcrição?';
    help.addEventListener('click', openTranscriptGuide);
    elements.transcript.append(help);
    return;
  }
  const filtered = query
    ? state.cues.filter((cue) => cue.text.toLocaleLowerCase('pt-BR').includes(query))
    : state.cues;
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Nenhum trecho encontrado nesta seção.';
    elements.transcript.append(empty);
    return;
  }
  filtered.forEach((cue) => {
    if (cue.untimed) {
      const paragraph = document.createElement('p');
      paragraph.className = 'cue cue-untimed';
      paragraph.dataset.untimed = 'true';
      paragraph.textContent = cue.text;
      elements.transcript.append(paragraph);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cue';
    button.dataset.start = String(cue.start);
    button.dataset.end = String(cue.end);
    const time = document.createElement('span');
    time.className = 'cue-time';
    time.textContent = formatTime(cue.start);
    const text = document.createElement('span');
    text.textContent = cue.text;
    button.append(time, text);
    button.addEventListener('click', () => seekTo(cue.start));
    elements.transcript.append(button);
  });
}

function renderSectionSummary() {
  const chapter = currentChapter();
  if (!chapter) return;
  const indices = currentChapterIndices();
  elements.sectionPosition.textContent = `${indices.indexOf(state.index) + 1} de ${indices.length}`;
  elements.sectionRange.textContent = chapter.title;
  elements.resumePoint.textContent = formatTime(currentPosition());
  elements.sectionDuration.textContent =
    chapter.durationLabel || formatTime(elements.audio.duration);
  elements.transcriptState.textContent = state.cues.length
    ? chapter.transcriptKind === 'markdown'
      ? 'Texto não sincronizado'
      : `${state.cues.length} trechos sincronizados`
    : 'Sem transcrição';
  elements.miniTitle.textContent = chapter.title;
}

function renderChapters() {
  const listening = readListening();
  elements.chapterList.replaceChildren();
  currentChapterIndices().forEach((index) => {
    const chapter = state.chapters[index];
    const item = document.createElement('li');
    item.className = 'chapter-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.setAttribute('aria-current', String(index === state.index));
    const number = document.createElement('span');
    number.className = 'chapter-number';
    number.textContent = String(chapter.number).padStart(2, '0');
    const title = document.createElement('span');
    title.className = 'section-title';
    title.textContent = chapter.title;
    if (!chapter.audio && !chapter.transcript) title.classList.add('chapter-unavailable');
    const progress = document.createElement('span');
    progress.className = 'chapter-progress';
    const stoppedAt = state.positions[chapter.id]
      ? formatTime(state.positions[chapter.id])
      : '0:00';
    const heardFor = listening[chapter.id] ? formatTime(listening[chapter.id]) : '0:00';
    progress.textContent = `${stoppedAt} · ${heardFor}`;
    const meta = document.createElement('span');
    meta.className = 'section-card-meta';
    meta.textContent = `${chapter.durationLabel || 'duração aberta'} · ${
      chapter.transcript ? 'transcrição disponível' : 'sem transcrição'
    } · retomada ${stoppedAt}`;
    const copy = document.createElement('span');
    copy.className = 'section-card-copy';
    copy.append(title, meta);
    button.append(number, copy, progress);
    button.addEventListener('click', () => selectChapter(index));
    item.append(button);
    elements.chapterList.append(item);
  });
}

function renderCompletion() {
  const chapters = currentChapterIndices().map((index) => state.chapters[index]);
  const progress = chapters.map((chapter) => {
    const duration = chapter.runtimeDuration || chapter.durationSeconds;
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return Math.min(1, (state.positions[chapter.id] || 0) / duration);
  });
  const percent = progress.length
    ? Math.round((progress.reduce((total, value) => total + value, 0) / progress.length) * 100)
    : 0;
  const completed = progress.filter((value) => value >= 0.95).length;
  elements.completion.textContent = `${percent}% ouvido · ${completed}/${progress.length} concluídas`;
  renderListeningTime();
}

async function selectChapter(index) {
  if (!state.chapters[index]) return;
  persistPositions(true);
  elements.audio.pause();
  stopSpeech();
  setPlaying(false);
  state.index = index;
  state.speechPosition = 0;
  const chapter = currentChapter();
  saveChapter(chapter.id);
  elements.bookContext.textContent = chapter.local
    ? `${chapter.bookTitle} · biblioteca local`
    : 'Demonstração hospedada: Dom Casmurro, de Machado de Assis';
  elements.miniPlayerOpen.classList.toggle('local', Boolean(chapter.local));
  elements.miniCoverImage.hidden = Boolean(chapter.local);
  elements.title.textContent = `Seção ${chapter.number} — ${chapter.title}`;
  elements.status.textContent = chapter.audio
    ? 'Áudio disponível'
    : chapter.transcript
    ? 'Voz do navegador disponível'
    : 'Conteúdo em preparação';
  elements.audio.removeAttribute('src');
  if (chapter.audio) elements.audio.src = new URL(chapter.audio, document.baseURI).href;
  state.cues = [];
  try {
    state.cues = await loadTranscript(chapter.transcript, chapter.transcriptKind);
  } catch {
    notify('Não foi possível carregar a transcrição.');
  }
  elements.transcriptSearch.value = '';
  state.transcriptAutoscroll = true;
  renderSectionSummary();
  renderTranscript();
  renderChapters();
  const saved = state.positions[chapter.id] || 0;
  if (chapter.audio) {
    elements.audio.load();
    elements.audio.addEventListener(
      'loadedmetadata',
      () => {
        if (saved < elements.audio.duration) elements.audio.currentTime = saved;
        chapter.runtimeDuration = elements.audio.duration;
        elements.sectionDuration.textContent = formatTime(elements.audio.duration);
        updateProgress(elements.audio.currentTime, elements.audio.duration);
        if (chapter.local) renderLocalBooks();
      },
      { once: true }
    );
  } else {
    state.speechPosition = saved;
    updateProgress(saved, estimatedSpeechDuration());
  }
  elements.play.disabled = !chapter.audio && !state.cues.length;
  elements.download.disabled = chapter.local || (!chapter.audio && !chapter.transcript);
  elements.download.textContent = chapter.local
    ? 'Salvo neste dispositivo'
    : 'Salvar para ouvir offline';
  const indices = currentChapterIndices();
  const groupPosition = indices.indexOf(state.index);
  elements.previous.disabled = groupPosition <= 0;
  elements.next.disabled = groupPosition >= indices.length - 1;
  elements.transcriptFollow.setAttribute('aria-pressed', 'true');
}

function renderBookmarks() {
  elements.bookmarkList.replaceChildren();
  if (!state.bookmarks.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Nenhum marcador salvo ainda.';
    elements.bookmarkList.append(empty);
    return;
  }
  state.bookmarks.forEach((bookmark) => {
    const chapterIndex = state.chapters.findIndex((chapter) => chapter.id === bookmark.chapterId);
    if (chapterIndex < 0) return;
    const chapter = state.chapters[chapterIndex];
    const item = document.createElement('li');
    item.className = 'bookmark-item';
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'bookmark-jump';
    jump.textContent = bookmark.note || `Marcador em ${formatTime(bookmark.time)}`;
    const meta = document.createElement('span');
    meta.className = 'bookmark-meta';
    meta.textContent = `Seção ${chapter.number} · ${formatTime(bookmark.time)}`;
    jump.append(meta);
    jump.addEventListener('click', async () => {
      await selectChapter(chapterIndex);
      seekTo(bookmark.time);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = 'Remover';
    remove.setAttribute(
      'aria-label',
      `Remover marcador: ${bookmark.note || formatTime(bookmark.time)}`
    );
    remove.addEventListener('click', () => {
      state.bookmarks = saveBookmarks(
        state.bookmarks.filter((itemBookmark) => itemBookmark.id !== bookmark.id)
      );
      renderBookmarks();
    });
    item.append(jump, remove);
    elements.bookmarkList.append(item);
  });
}

function exportBookmarks() {
  const blob = new Blob([JSON.stringify(state.bookmarks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dom-casmurro-marcadores.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function importBookmarks(file) {
  if (!file || file.size > 100_000) throw new Error('O arquivo deve ter no máximo 100 KB.');
  const parsed = JSON.parse(await file.text());
  if (!Array.isArray(parsed)) throw new Error('O arquivo precisa conter uma lista de marcadores.');
  state.bookmarks = saveBookmarks(parsed);
  renderBookmarks();
}

async function cacheCurrentChapter() {
  const chapter = currentChapter();
  if (!chapter || !('serviceWorker' in navigator))
    return notify('Modo offline indisponível neste navegador.');
  if (chapter.local) return notify('Este áudio importado já está salvo neste dispositivo.');
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active;
  if (!worker) return notify('O modo offline ainda está sendo preparado.');
  const requestId = crypto.randomUUID();
  state.offlineRequestId = requestId;
  window.clearTimeout(state.offlineTimer);
  state.offlineTimer = window.setTimeout(() => {
    if (state.offlineRequestId !== requestId) return;
    state.offlineRequestId = null;
    elements.download.disabled = false;
    elements.download.textContent = 'Tentar salvar novamente';
    notify('O download offline demorou mais que o esperado. Tente novamente.');
  }, 30_000);
  elements.download.disabled = true;
  elements.download.textContent = 'Salvando…';
  worker.postMessage({
    type: 'CACHE_CHAPTER',
    requestId,
    assets: [chapter.audio, chapter.transcript].filter(Boolean),
  });
  notify('Download offline iniciado.');
}

async function reloadLibrary(selectLast = false) {
  state.chapters
    .flatMap((chapter) => chapter.objectUrls || [])
    .forEach((url) => URL.revokeObjectURL(url));
  const [builtIn, local, localBooks] = await Promise.all([
    loadCatalog(),
    listLocalChapters(),
    listLocalBooks(),
  ]);
  state.chapters = [...builtIn, ...local];
  state.localBooks = localBooks;
  renderChapters();
  renderLocalBooks();
  await refreshStorageSummary();
  if (selectLast && local.length) await selectChapter(state.chapters.length - local.length);
}

function renderLocalBooks() {
  elements.localBookList.replaceChildren();
  if (!state.localBooks.length) {
    const empty = document.createElement('li');
    empty.className = 'empty local-library-empty';
    empty.textContent = 'Nenhum livro importado. A amostra de Dom Casmurro continua disponível.';
    elements.localBookList.append(empty);
    return;
  }

  state.localBooks.forEach((book) => {
    const item = document.createElement('li');
    item.className = 'local-book-item';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = book.title;
    const meta = document.createElement('span');
    meta.textContent = `${book.author} · ${book.chapterCount} faixa(s) · ${formatBytes(book.size)}`;
    const progressValues = book.chapterIds.map((chapterId) => {
      const chapter = state.chapters.find((item) => item.id === chapterId);
      const duration = chapter?.runtimeDuration || chapter?.durationSeconds;
      return Number.isFinite(duration) && duration > 0
        ? Math.min(1, (state.positions[chapterId] || 0) / duration)
        : 0;
    });
    const progress = progressValues.length
      ? Math.round(
          (progressValues.reduce((total, value) => total + value, 0) / progressValues.length) * 100
        )
      : 0;
    const started = book.chapterIds.some((chapterId) => (state.positions[chapterId] || 0) > 0);
    const progressTrack = document.createElement('span');
    progressTrack.className = 'book-progress';
    const progressValue = document.createElement('span');
    progressValue.style.width = `${progress || (started ? 8 : 0)}%`;
    progressTrack.append(progressValue);
    const progressLabel = document.createElement('small');
    progressLabel.textContent = progress
      ? `${progress}% ouvido`
      : started
      ? 'Em andamento'
      : 'Ainda não iniciado';
    copy.append(title, meta, progressTrack, progressLabel);

    const actions = document.createElement('div');
    actions.className = 'local-book-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'button button-secondary';
    open.textContent = 'Abrir';
    open.addEventListener('click', () => {
      const index = state.chapters.findIndex((chapter) => chapter.bookId === book.id);
      if (index >= 0) selectChapter(index);
      document.getElementById('player').scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = 'Excluir';
    remove.setAttribute('aria-label', `Excluir livro ${book.title}`);
    remove.addEventListener('click', async () => {
      if (
        !window.confirm(`Excluir “${book.title}” deste navegador? Esta ação não pode ser desfeita.`)
      ) {
        return;
      }
      try {
        const deletingCurrent = currentChapter()?.bookId === book.id;
        await deleteLocalBook(book.id);
        removeChapterData(book.chapterIds);
        state.bookmarks = loadBookmarks();
        await reloadLibrary(false);
        await selectChapter(deletingCurrent ? 0 : Math.min(state.index, state.chapters.length - 1));
        renderBookmarks();
        notify('Livro excluído e espaço liberado.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Não foi possível excluir o livro.');
      }
    });
    actions.append(open, remove);
    item.append(copy, actions);
    elements.localBookList.append(item);
  });
}

async function refreshStorageSummary(requestPersistence = false) {
  const localSize = state.localBooks.reduce((total, book) => total + book.size, 0);
  elements.libraryStorage.textContent = `${state.localBooks.length} livro(s) · ${formatBytes(
    localSize
  )}`;

  if (!navigator.storage?.estimate) {
    elements.browserStorage.textContent = 'Estimativa indisponível';
    elements.storagePersistence.textContent = 'Não suportado';
    return;
  }

  try {
    if (requestPersistence && navigator.storage.persist) await navigator.storage.persist();
    const [{ usage = 0, quota = 0 }, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
    ]);
    elements.browserStorage.textContent = quota
      ? `${formatBytes(usage)} usados de ${formatBytes(quota)}`
      : `${formatBytes(usage)} usados`;
    elements.storagePersistence.textContent = persisted
      ? 'Persistente'
      : 'Pode ser removido pelo navegador';
  } catch {
    elements.browserStorage.textContent = 'Não foi possível calcular';
    elements.storagePersistence.textContent = 'Não foi possível verificar';
  }
}

function normalizedStem(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/^0+(?=\d)/, '');
}

function renderImportPreview() {
  const files = Array.from(elements.libraryFiles.files || []);
  elements.importFileList.replaceChildren();
  if (!files.length) {
    elements.importPreview.hidden = true;
    return;
  }

  const audioFiles = files
    .filter((file) => file.type.startsWith('audio/'))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  const transcripts = new Map(
    files
      .filter((file) => /\.(?:vtt|md)$/i.test(file.name))
      .map((file) => [normalizedStem(file.name), file])
  );
  const matchedNames = new Set();

  audioFiles.forEach((audio, index) => {
    const transcript =
      transcripts.get(normalizedStem(audio.name)) || transcripts.get(String(index + 1));
    if (transcript) matchedNames.add(transcript.name);
    const item = document.createElement('li');
    const audioName = document.createElement('strong');
    audioName.textContent = audio.name;
    const result = document.createElement('span');
    result.className = transcript ? 'match-success' : 'match-optional';
    result.textContent = transcript
      ? `Transcrição associada: ${transcript.name}`
      : 'Sem transcrição — a faixa funcionará normalmente';
    item.append(audioName, result);
    elements.importFileList.append(item);
  });

  const unmatched = files.filter(
    (file) => /\.(?:vtt|md)$/i.test(file.name) && !matchedNames.has(file.name)
  );
  unmatched.forEach((file) => {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = file.name;
    const result = document.createElement('span');
    result.className = 'match-warning';
    result.textContent = 'Sem faixa de áudio correspondente';
    item.append(name, result);
    elements.importFileList.append(item);
  });

  const matchedCount = matchedNames.size;
  elements.importSummary.textContent = audioFiles.length
    ? `${audioFiles.length} faixa(s) de áudio · ${matchedCount} transcrição(ões) associada(s)`
    : 'Nenhuma faixa de áudio válida foi selecionada.';
  elements.importPreview.hidden = false;
}

function bindEvents() {
  elements.play.addEventListener('click', togglePlayback);
  elements.previous.addEventListener('click', () => {
    const indices = currentChapterIndices();
    const position = indices.indexOf(state.index);
    selectChapter(indices[Math.max(0, position - 1)]);
  });
  elements.next.addEventListener('click', () => {
    const indices = currentChapterIndices();
    const position = indices.indexOf(state.index);
    selectChapter(indices[Math.min(indices.length - 1, position + 1)]);
  });
  elements.backward.addEventListener('click', () => seekTo(currentPosition() - 15));
  elements.forward.addEventListener('click', () => seekTo(currentPosition() + 15));
  elements.progress.addEventListener('input', () => {
    const duration = currentChapter()?.audio ? elements.audio.duration : estimatedSpeechDuration();
    seekTo((Number(elements.progress.value) / 100) * (duration || 0));
  });
  elements.speed.addEventListener('change', () => {
    saveSpeed(elements.speed.value);
    elements.audio.playbackRate = Number(elements.speed.value);
    if (state.speech) startSpeech(state.speechPosition);
  });
  elements.audio.addEventListener('play', () => setPlaying(true));
  elements.audio.addEventListener('pause', () => {
    setPlaying(false);
    persistPositions(true);
  });
  elements.audio.addEventListener('timeupdate', () =>
    updateProgress(elements.audio.currentTime, elements.audio.duration)
  );
  elements.audio.addEventListener('ended', () => {
    const indices = currentChapterIndices();
    const position = indices.indexOf(state.index);
    if (position < indices.length - 1) selectChapter(indices[position + 1]);
  });
  elements.audio.addEventListener('error', () => notify(audioErrorMessage()));
  elements.volume.addEventListener('input', () => setVolume(elements.volume.value));
  elements.mute.addEventListener('click', () => setVolume(elements.audio.volume > 0 ? 0 : 1));
  elements.download.addEventListener('click', cacheCurrentChapter);
  elements.bookmarkForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const chapter = currentChapter();
    if (!chapter) return;
    state.bookmarks.unshift({
      id: crypto.randomUUID(),
      chapterId: chapter.id,
      time: currentPosition(),
      note: elements.bookmarkNote.value.trim(),
      createdAt: new Date().toISOString(),
    });
    state.bookmarks = saveBookmarks(state.bookmarks);
    elements.bookmarkNote.value = '';
    renderBookmarks();
    notify('Marcador adicionado.');
  });
  elements.exportBookmarks.addEventListener('click', exportBookmarks);
  elements.importBookmarks.addEventListener('change', async () => {
    try {
      await importBookmarks(elements.importBookmarks.files[0]);
      notify('Marcadores importados.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Arquivo inválido.');
    }
    elements.importBookmarks.value = '';
  });
  elements.transcriptSearch.addEventListener('input', () => {
    state.transcriptAutoscroll = !elements.transcriptSearch.value.trim();
    elements.transcriptFollow.setAttribute('aria-pressed', String(state.transcriptAutoscroll));
    renderTranscript();
    if (!elements.transcriptSearch.value.trim()) highlightCue(currentPosition());
  });
  elements.transcript.addEventListener('pointerdown', () => {
    state.transcriptAutoscroll = false;
    elements.transcriptFollow.setAttribute('aria-pressed', 'false');
  });
  elements.transcriptSmaller.addEventListener('click', () =>
    applyTranscriptSize(state.transcriptSize - 0.1)
  );
  elements.transcriptLarger.addEventListener('click', () =>
    applyTranscriptSize(state.transcriptSize + 0.1)
  );
  elements.transcriptFollow.addEventListener('click', () => {
    state.transcriptAutoscroll = !state.transcriptAutoscroll;
    elements.transcriptFollow.setAttribute('aria-pressed', String(state.transcriptAutoscroll));
    if (state.transcriptAutoscroll) highlightCue(currentPosition());
  });
  elements.themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  elements.helpOpen.addEventListener('click', openHelp);
  elements.helpClose.addEventListener('click', closeHelp);
  elements.helpDialog.addEventListener('click', (event) => {
    if (event.target === elements.helpDialog) closeHelp();
  });
  elements.transcriptGuideOpen.addEventListener('click', openTranscriptGuide);
  elements.transcriptGuideInline.addEventListener('click', openTranscriptGuide);
  elements.transcriptGuideClose.addEventListener('click', closeTranscriptGuide);
  elements.transcriptGuide.addEventListener('click', (event) => {
    if (event.target === elements.transcriptGuide) closeTranscriptGuide();
  });
  elements.welcomeSample.addEventListener('click', () => closeWelcome('player'));
  elements.welcomeImport.addEventListener('click', () => closeWelcome('import-title'));
  elements.welcomeSkip.addEventListener('click', () => closeWelcome());
  elements.focusMode.addEventListener('click', () => {
    const enabled = !document.body.classList.contains('focus-mode');
    applyFocusMode(enabled);
    document.getElementById('player').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  elements.libraryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await saveLocalBook({
        title: elements.libraryTitle.value,
        author: elements.libraryAuthor.value,
        files: elements.libraryFiles.files,
      });
      elements.libraryForm.reset();
      renderImportPreview();
      await reloadLibrary(true);
      await refreshStorageSummary(true);
      notify('Audiobook importado para a biblioteca local.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível importar o audiobook.');
    }
  });
  elements.libraryFiles.addEventListener('change', renderImportPreview);
  elements.refreshStorage.addEventListener('click', () => refreshStorageSummary(true));
  elements.miniPlay.addEventListener('click', togglePlayback);
  elements.miniBackward.addEventListener('click', () => seekTo(currentPosition() - 15));
  elements.miniForward.addEventListener('click', () => seekTo(currentPosition() + 15));
  elements.miniPlayerOpen.addEventListener('click', () =>
    document.getElementById('player').scrollIntoView({ block: 'start', behavior: 'smooth' })
  );
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (
      event.data?.type !== 'CACHE_CHAPTER_RESULT' ||
      event.data.requestId !== state.offlineRequestId
    ) {
      return;
    }
    state.offlineRequestId = null;
    window.clearTimeout(state.offlineTimer);
    elements.download.disabled = false;
    elements.download.textContent = event.data.ok
      ? 'Disponível offline'
      : 'Tentar salvar novamente';
    notify(
      event.data.ok
        ? 'Seção salva para reprodução offline.'
        : 'Não foi possível salvar todos os arquivos desta seção.'
    );
  });
  document.addEventListener('keydown', (event) => {
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      togglePlayback();
    }
    if (event.code === 'ArrowLeft') seekTo(currentPosition() - 15);
    if (event.code === 'ArrowRight') seekTo(currentPosition() + 15);
  });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstall = event;
    elements.install.hidden = false;
  });
  window.addEventListener('pagehide', () => persistPositions(true));
  elements.install.addEventListener('click', async () => {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall = null;
    elements.install.hidden = true;
  });
}

async function init() {
  bindEvents();
  applyTheme(loadPreference('theme', prefersDark ? 'dark' : 'light'));
  applyFocusMode(loadPreference('focus', 'off') === 'on');
  applyTranscriptSize(loadPreference('transcriptSize', 1));
  if (window.matchMedia('(max-width: 760px)').matches) {
    document.querySelector('.player-more')?.removeAttribute('open');
  }
  const playerState = getPlayerState();
  state.positions = playerState.positions;
  elements.speed.value = String(playerState.speed);
  elements.audio.playbackRate = playerState.speed;
  setVolume(playerState.volume);
  startListeningTicker();
  try {
    await reloadLibrary(false);
    const savedIndex = state.chapters.findIndex((chapter) => chapter.id === playerState.chapterId);
    await selectChapter(savedIndex >= 0 ? savedIndex : 0);
    renderBookmarks();
    if (
      loadPreference('welcome', 'new') !== 'seen' &&
      typeof elements.welcomeDialog.showModal === 'function'
    ) {
      elements.welcomeDialog.showModal();
      elements.welcomeSample.focus();
    }
  } catch (error) {
    elements.title.textContent = 'Não foi possível carregar o livro';
    elements.status.textContent = error instanceof Error ? error.message : 'Erro inesperado';
    elements.play.disabled = true;
  }
  const playerObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) state.playerVisited = true;
      elements.miniPlayer.hidden =
        entry.isIntersecting || !state.playerVisited || !currentChapter();
    },
    { threshold: 0.2 }
  );
  playerObserver.observe(document.getElementById('player'));
  const localHostnames = ['localhost', '127.0.0.1', '::1'];
  const isLocalhost = localHostnames.includes(location.hostname);
  if ('serviceWorker' in navigator && isLocalhost) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .catch(() => {});
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isLocalhost) {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        registration.update();
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => notify('O modo offline não pôde ser ativado.'));
  }
}

init();
