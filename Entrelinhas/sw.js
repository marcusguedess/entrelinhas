const VERSION = 'v8';
const SHELL_CACHE = `entrelinhas-shell-${VERSION}`;
const MEDIA_CACHE = `entrelinhas-media-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './reset.html',
  './data/catalog.json',
  './js/app.js',
  './js/catalog.js',
  './js/library.js',
  './js/storage.js',
  './js/transcript.js',
  './js/reset.js',
  './imagens/dom-casmurro.jpeg',
  './imagens/icon.svg',
  './imagens/icon-192.png',
  './imagens/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([self.skipWaiting(), caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL))])
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name.startsWith('entrelinhas-') && ![SHELL_CACHE, MEDIA_CACHE].includes(name)
            )
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isSafeAsset(value) {
  try {
    const url = new URL(value, self.location.href);
    return (
      url.origin === self.location.origin && /\.(?:mp3|m4a|ogg|wav|vtt|md)$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function isMediaRequest(url) {
  return /\.(?:mp3|m4a|ogg|wav|vtt)$/i.test(url.pathname);
}

function parseRangeHeader(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '');
  if (!match) return null;

  let start = match[1] === '' ? null : Number(match[1]);
  let end = match[2] === '' ? null : Number(match[2]);

  if (start === null && end === null) return null;
  if (start === null) {
    const suffixLength = end;
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    if (!Number.isFinite(start) || start < 0) return null;
    end = end === null ? size - 1 : end;
  }

  if (!Number.isFinite(end) || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

async function cachedRangeResponse(request) {
  const cached = await caches.match(request.url);
  if (!cached) return fetch(request);

  const buffer = await cached.arrayBuffer();
  const range = parseRangeHeader(request.headers.get('range'), buffer.byteLength);
  if (!range) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: {
        'Content-Range': `bytes */${buffer.byteLength}`,
        'Accept-Ranges': 'bytes',
      },
    });
  }

  const { start, end } = range;
  const body = buffer.slice(start, end + 1);
  const headers = new Headers(cached.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(body.byteLength));
  headers.set('Content-Range', `bytes ${start}-${end}/${buffer.byteLength}`);
  return new Response(body, { status: 206, statusText: 'Partial Content', headers });
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type !== 'CACHE_CHAPTER' || !Array.isArray(event.data.assets)) return;
  const assets = event.data.assets.filter(isSafeAsset).slice(0, 3);
  event.waitUntil(
    caches.open(MEDIA_CACHE).then(async (cache) => {
      let cached = 0;
      for (const asset of assets) {
        try {
          const response = await fetch(asset, { credentials: 'same-origin' });
          if (response.ok) {
            await cache.put(asset, response);
            cached += 1;
          }
        } catch {
          // O resultado agregado é enviado à interface no fim da operação.
        }
      }
      event.source?.postMessage({
        type: 'CACHE_CHAPTER_RESULT',
        requestId: event.data.requestId,
        ok: assets.length > 0 && cached === assets.length,
        cached,
        total: assets.length,
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok)
            caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', response.clone()));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (isMediaRequest(url)) {
    if (request.headers.has('range')) {
      event.respondWith(cachedRangeResponse(request));
      return;
    }
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  if (url.pathname.endsWith('/data/catalog.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok)
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok)
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
    )
  );
});
