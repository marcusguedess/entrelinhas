import { loadCatalog } from './catalog.js';
import { listLocalChapters, saveLocalBook } from './library.js';
import { loadTranscript } from './transcript.js';
import {
  addListeningTime,
  getPlayerState,
  loadPreference,
  loadBookmarks,
  readListening,
  saveBookmarks,
  saveChapter,
  savePreference,
  savePosition,
  saveSpeed,
  saveVolume,
} from './storage.js';

const elements = Object.freeze({
  audio: document.getElementById('audio'),
  title: document.getElementById('chapter-title'),
  status: document.getElementById('player-status'),
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
  themeToggle: document.getElementById('theme-toggle'),
  visual: document.getElementById('sound-visual'),
  chapterList: document.getElementById('chapter-list'),
  transcript: document.getElementById('transcript'),
  transcriptSearch: document.getElementById('transcript-search'),
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
  install: document.getElementById('install-app'),
  toast: document.getElementById('toast'),
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
};

function applyTheme(theme) {
  const resolved = theme === 'dark' || theme === 'light' ? theme : (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = resolved;
  elements.themeToggle.setAttribute('aria-label', resolved === 'dark' ? 'Ativar modo claro' : 'Ativar modo noturno');
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

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = String(safe % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

function notify(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 3500);
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

function currentChapter() { return state.chapters[state.index]; }
function currentPosition() { return currentChapter()?.audio ? elements.audio.currentTime : state.speechPosition; }
function estimatedSpeechDuration() {
  const words = state.cues.reduce((total, cue) => total + cue.text.split(/\s+/).length, 0);
  return words ? (words / (150 * Number(elements.speed.value))) * 60 : 0;
}

function setPlaying(playing) {
  elements.play.textContent = playing ? '❚❚' : '▶';
  elements.play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir');
  elements.play.setAttribute('aria-pressed', String(playing));
  elements.visual.classList.toggle('active', playing);
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
  const chapter = currentChapter();
  if (chapter) savePosition(chapter.id, position);
  highlightCue(position);
  renderCompletion();
}

function highlightCue(position) {
  let activeCue = null;
  elements.transcript.querySelectorAll('.cue').forEach((button) => {
    if (button.dataset.untimed === 'true') return;
    const active = position >= Number(button.dataset.start) && position < Number(button.dataset.end);
    button.classList.toggle('active', active);
    if (active) {
      button.setAttribute('aria-current', 'true');
      activeCue = button;
    } else button.removeAttribute('aria-current');
  });
  if (activeCue && activeCue !== state.lastActiveCue && state.transcriptAutoscroll) {
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
  utterance.onend = () => { setPlaying(false); window.clearInterval(state.speechTimer); };
  utterance.onerror = () => { setPlaying(false); notify('Não foi possível usar a voz do navegador.'); };
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
      try { await elements.audio.play(); } catch (error) { notify(audioErrorMessage(error)); }
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
    renderChapters();
  }, 1000);
}

function seekTo(seconds) {
  const chapter = currentChapter();
  if (!chapter) return;
  if (chapter.audio) elements.audio.currentTime = Math.max(0, Math.min(elements.audio.duration || 0, seconds));
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
    empty.textContent = 'A transcrição desta seção ainda não foi adicionada.';
    elements.transcript.append(empty);
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
  elements.sectionPosition.textContent = `${chapter.number} de ${state.chapters.length}`;
  elements.sectionRange.textContent = chapter.title;
  elements.resumePoint.textContent = formatTime(currentPosition());
  elements.sectionDuration.textContent = chapter.durationLabel || formatTime(elements.audio.duration);
  elements.transcriptState.textContent = state.cues.length ? `${state.cues.length} trechos` : 'Indisponível';
}

function renderChapters() {
  const positions = getPlayerState().positions;
  const listening = readListening();
  elements.chapterList.replaceChildren();
  state.chapters.forEach((chapter, index) => {
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
    const stoppedAt = positions[chapter.id] ? formatTime(positions[chapter.id]) : '0:00';
    const heardFor = listening[chapter.id] ? formatTime(listening[chapter.id]) : '0:00';
    progress.textContent = `${stoppedAt} · ${heardFor}`;
    const meta = document.createElement('span');
    meta.className = 'section-card-meta';
    meta.textContent = `${chapter.durationLabel || 'duração aberta'} · ${chapter.transcript ? 'transcrição disponível' : 'sem transcrição'} · retomada ${stoppedAt}`;
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
  const positions = getPlayerState().positions;
  const started = state.chapters.filter((chapter) => positions[chapter.id] > 0).length;
  const percent = state.chapters.length ? Math.round((started / state.chapters.length) * 100) : 0;
  elements.completion.textContent = `${percent}% iniciado`;
  renderListeningTime();
}

async function selectChapter(index) {
  if (!state.chapters[index]) return;
  elements.audio.pause();
  stopSpeech();
  setPlaying(false);
  state.index = index;
  state.speechPosition = 0;
  const chapter = currentChapter();
  saveChapter(chapter.id);
  elements.title.textContent = `Seção ${chapter.number} — ${chapter.title}`;
  elements.status.textContent = chapter.audio ? 'Áudio disponível' : chapter.transcript ? 'Voz do navegador disponível' : 'Conteúdo em preparação';
  elements.audio.removeAttribute('src');
  if (chapter.audio) elements.audio.src = new URL(chapter.audio, document.baseURI).href;
  state.cues = [];
  try { state.cues = await loadTranscript(chapter.transcript); }
  catch { notify('Não foi possível carregar a transcrição.'); }
  elements.transcriptSearch.value = '';
  state.transcriptAutoscroll = true;
  renderSectionSummary();
  renderTranscript();
  renderChapters();
  const saved = getPlayerState().positions[chapter.id] || 0;
  if (chapter.audio) {
    elements.audio.load();
    elements.audio.addEventListener('loadedmetadata', () => {
      if (saved < elements.audio.duration) elements.audio.currentTime = saved;
      elements.sectionDuration.textContent = formatTime(elements.audio.duration);
      updateProgress(elements.audio.currentTime, elements.audio.duration);
    }, { once: true });
  } else {
    state.speechPosition = saved;
    updateProgress(saved, estimatedSpeechDuration());
  }
  elements.play.disabled = !chapter.audio && !state.cues.length;
  elements.download.disabled = !chapter.audio && !chapter.transcript;
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
    jump.addEventListener('click', async () => { await selectChapter(chapterIndex); seekTo(bookmark.time); });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover marcador: ${bookmark.note || formatTime(bookmark.time)}`);
    remove.addEventListener('click', () => {
      state.bookmarks = saveBookmarks(state.bookmarks.filter((itemBookmark) => itemBookmark.id !== bookmark.id));
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
  if (!chapter || !('serviceWorker' in navigator)) return notify('Modo offline indisponível neste navegador.');
  if (chapter.local) return notify('Este áudio importado já está salvo neste dispositivo.');
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active;
  if (!worker) return notify('O modo offline ainda está sendo preparado.');
  worker.postMessage({ type: 'CACHE_CHAPTER', assets: [chapter.audio, chapter.transcript].filter(Boolean) });
  notify('Seção enviada para o armazenamento offline.');
}

async function reloadLibrary(selectLast = false) {
  const builtIn = await loadCatalog();
  const local = await listLocalChapters();
  state.chapters = [...builtIn, ...local];
  renderChapters();
  if (selectLast && local.length) await selectChapter(state.chapters.length - local.length);
}

function bindEvents() {
  elements.play.addEventListener('click', togglePlayback);
  elements.previous.addEventListener('click', () => selectChapter(Math.max(0, state.index - 1)));
  elements.next.addEventListener('click', () => selectChapter(Math.min(state.chapters.length - 1, state.index + 1)));
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
  elements.audio.addEventListener('pause', () => setPlaying(false));
  elements.audio.addEventListener('timeupdate', () => updateProgress(elements.audio.currentTime, elements.audio.duration));
  elements.audio.addEventListener('ended', () => state.index < state.chapters.length - 1 && selectChapter(state.index + 1));
  elements.audio.addEventListener('error', () => notify(audioErrorMessage()));
  elements.volume.addEventListener('input', () => setVolume(elements.volume.value));
  elements.mute.addEventListener('click', () => setVolume(elements.audio.volume > 0 ? 0 : 1));
  elements.download.addEventListener('click', cacheCurrentChapter);
  elements.bookmarkForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const chapter = currentChapter();
    if (!chapter) return;
    state.bookmarks.unshift({ id: crypto.randomUUID(), chapterId: chapter.id, time: currentPosition(), note: elements.bookmarkNote.value.trim(), createdAt: new Date().toISOString() });
    state.bookmarks = saveBookmarks(state.bookmarks);
    elements.bookmarkNote.value = '';
    renderBookmarks();
    notify('Marcador adicionado.');
  });
  elements.exportBookmarks.addEventListener('click', exportBookmarks);
  elements.importBookmarks.addEventListener('change', async () => {
    try { await importBookmarks(elements.importBookmarks.files[0]); notify('Marcadores importados.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Arquivo inválido.'); }
    elements.importBookmarks.value = '';
  });
  elements.transcriptSearch.addEventListener('input', () => {
    state.transcriptAutoscroll = !elements.transcriptSearch.value.trim();
    renderTranscript();
    if (!elements.transcriptSearch.value.trim()) highlightCue(currentPosition());
  });
  elements.transcript.addEventListener('pointerdown', () => {
    state.transcriptAutoscroll = false;
  });
  elements.themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
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
      await reloadLibrary(true);
      notify('Audiobook importado para a biblioteca local.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível importar o audiobook.');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
    if (event.code === 'ArrowLeft') seekTo(currentPosition() - 15);
    if (event.code === 'ArrowRight') seekTo(currentPosition() + 15);
  });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); state.deferredInstall = event; elements.install.hidden = false;
  });
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
  const playerState = getPlayerState();
  elements.speed.value = String(playerState.speed);
  elements.audio.playbackRate = playerState.speed;
  setVolume(playerState.volume);
  startListeningTicker();
  try {
    await reloadLibrary(false);
    const savedIndex = state.chapters.findIndex((chapter) => chapter.id === playerState.chapterId);
    await selectChapter(savedIndex >= 0 ? savedIndex : 0);
    renderBookmarks();
  } catch (error) {
    elements.title.textContent = 'Não foi possível carregar o livro';
    elements.status.textContent = error instanceof Error ? error.message : 'Erro inesperado';
    elements.play.disabled = true;
  }
  const localHostnames = ['localhost', '127.0.0.1', '::1'];
  const isLocalhost = localHostnames.includes(location.hostname);
  if ('serviceWorker' in navigator && isLocalhost) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
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
