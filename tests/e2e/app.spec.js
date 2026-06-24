const { test, expect } = require('@playwright/test');

async function loadCatalog(page) {
  return page.evaluate(async () => {
    const response = await fetch('/data/catalog.json');
    if (!response.ok) throw new Error(`Catalog failed: ${response.status}`);
    return response.json();
  });
}

test('loads sections, transcripts, theme, and search', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('entrelinhas.theme.v1', 'light');
    localStorage.setItem('entrelinhas.focus.v1', 'off');
    localStorage.setItem('entrelinhas.welcome.v1', 'seen');
  });
  await page.goto('/');

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('heading', { name: /Seção 1 — Capítulos 1 a 5/i })).toBeVisible();
  await expect(page.locator('#transcript')).toContainText('Capítulo 5. O agregado.');
  await expect(page.locator('#transcript')).not.toContainText('Trecho de exemplo');

  await page.getByRole('button', { name: /Capítulos 6 a 10/i }).click();
  await expect(page.getByRole('heading', { name: /Seção 2 — Capítulos 6 a 10/i })).toBeVisible();
  await expect(page.locator('#transcript')).toContainText('Capítulo Sexto. Tio Cosme.');

  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByLabel('Buscar').fill('Dona Glória');
  await expect(page.locator('#transcript')).toContainText('Dona Glória');
});

test('opens and closes the usage help', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('entrelinhas.theme.v1', 'light');
    localStorage.setItem('entrelinhas.focus.v1', 'off');
    localStorage.setItem('entrelinhas.welcome.v1', 'seen');
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Como usar o Entrelinhas' }).click();
  await expect(page.getByRole('dialog', { name: 'Como usar o Entrelinhas' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Experimente a amostra');
  await expect(page.getByRole('dialog')).toContainText(
    'não envia sua biblioteca importada para servidor'
  );

  await page.getByRole('button', { name: 'Fechar ajuda' }).click();
  await expect(page.getByRole('dialog', { name: 'Como usar o Entrelinhas' })).not.toBeVisible();
});

test('serves and plays the Dom Casmurro sample audio', async ({ page, request }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('entrelinhas.theme.v1', 'light');
    localStorage.setItem('entrelinhas.focus.v1', 'off');
    localStorage.setItem('entrelinhas.welcome.v1', 'seen');
  });
  await page.goto('/');

  const catalog = await loadCatalog(page);
  const chapters = catalog.chapters.filter((chapter) => chapter.audio);
  expect(chapters).toHaveLength(10);

  for (const chapter of chapters) {
    const response = await request.get(chapter.audio, {
      headers: { Range: 'bytes=0-1' },
    });
    expect(response.status(), `${chapter.audio} must support byte ranges`).toBe(206);
    expect(response.headers()['accept-ranges']).toContain('bytes');
    expect(response.headers()['content-range']).toMatch(/^bytes 0-1\/\d+$/);
  }

  const metadata = await page.evaluate(async () => {
    const response = await fetch('/data/catalog.json');
    const catalogData = await response.json();
    const results = [];

    for (const chapter of catalogData.chapters) {
      const audio = new Audio(chapter.audio);
      audio.preload = 'metadata';
      const result = await new Promise((resolve) => {
        const cleanup = () => {
          audio.removeAttribute('src');
          audio.load();
        };
        audio.addEventListener(
          'loadedmetadata',
          () => {
            resolve({
              path: chapter.audio,
              duration: audio.duration,
              expectedDuration: chapter.durationSeconds,
            });
            cleanup();
          },
          { once: true }
        );
        audio.addEventListener(
          'error',
          () => {
            resolve({
              path: chapter.audio,
              error: audio.error ? audio.error.code : 'unknown',
            });
            cleanup();
          },
          { once: true }
        );
      });
      results.push(result);
    }

    return results;
  });

  for (const item of metadata) {
    expect(item.error, `${item.path} should load metadata`).toBeUndefined();
    expect(Number.isFinite(item.duration), `${item.path} duration should be finite`).toBe(true);
    expect(item.duration, `${item.path} duration should be meaningful`).toBeGreaterThan(60);
    expect(
      Math.abs(item.duration - item.expectedDuration),
      `${item.path} metadata duration should match catalog estimate`
    ).toBeLessThan(30);
  }

  await expect(page.getByRole('heading', { name: /Seção 1 — Capítulos 1 a 5/i })).toBeVisible();
  await page.locator('#audio').evaluate((audio) => {
    audio.muted = true;
    audio.currentTime = 0;
  });
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pausar');
  await page.waitForFunction(() => document.getElementById('audio').currentTime > 0.5, null, {
    timeout: 10_000,
  });
  const currentTime = await page.locator('#audio').evaluate((audio) => audio.currentTime);
  expect(currentTime).toBeGreaterThan(0.5);
});

test('explains the product and transcription limits on first visit', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');

  const welcome = page.getByRole('dialog', { name: /Ouça seus audiobooks/i });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('não é criada pelo Entrelinhas');

  await page.getByRole('button', { name: 'Ver a página primeiro' }).click();
  await expect(welcome).not.toBeVisible();

  await page.getByRole('button', { name: 'Como funcionam as transcrições?' }).click();
  const guide = page.getByRole('dialog', { name: /O texto é opcional/i });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('não possui servidor para processar áudio');
  await expect(guide).toContainText('.vtt');
  await expect(guide).toContainText('.md');
});

test('previews file matching and imports a local Markdown transcript', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('entrelinhas.welcome.v1', 'seen');
  });
  await page.goto('/');

  await page.getByLabel('Título').fill('Livro de teste');
  await page.getByLabel('Faixas de áudio e transcrições opcionais').setInputFiles([
    {
      name: '01.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('ID3 arquivo de teste'),
    },
    {
      name: '01.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Capítulo importado\n\nTexto Markdown disponível para leitura.'),
    },
  ]);

  await expect(page.locator('#import-preview')).toBeVisible();
  await expect(page.locator('#import-preview')).toContainText('1 faixa(s) de áudio');
  await expect(page.locator('#import-preview')).toContainText('Transcrição associada: 01.md');

  await page.getByRole('button', { name: 'Adicionar à biblioteca local' }).click();
  await expect(page.getByRole('heading', { name: /Livro de teste · 01/i })).toBeVisible();
  await expect(page.locator('#transcript')).toContainText('Capítulo importado');
  await expect(page.locator('#transcript-state')).toHaveText('Texto não sincronizado');
  await expect(page.locator('#local-book-list')).toContainText('Livro de teste');
  await expect(page.locator('#local-book-list')).toContainText('1 faixa(s)');
  await expect(page.locator('#chapter-list .chapter-item')).toHaveCount(1);
});

test('shows the compact player after leaving the full player', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('entrelinhas.welcome.v1', 'seen');
  });
  await page.goto('/');

  await page.locator('.app-nav a[href="#player"]').click();
  await expect(page.locator('#player')).toBeInViewport();
  await page.locator('.app-nav a[href="#library-section"]').click();
  await expect(page.locator('#mini-player')).toBeVisible();
  await expect(page.locator('#mini-title')).toContainText('Capítulos 1 a 5');
});

test('deletes an imported book and returns to the demonstration', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('entrelinhas.welcome.v1', 'seen');
  });
  await page.goto('/');

  await page.getByLabel('Título').fill('Livro descartável');
  await page.getByLabel('Faixas de áudio e transcrições opcionais').setInputFiles({
    name: '01.mp3',
    mimeType: 'audio/mpeg',
    buffer: Buffer.from('ID3 arquivo descartável'),
  });
  await page.getByRole('button', { name: 'Adicionar à biblioteca local' }).click();
  await expect(page.locator('#local-book-list')).toContainText('Livro descartável');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Excluir livro Livro descartável' }).click();

  await expect(page.locator('#local-book-list')).not.toContainText('Livro descartável');
  await expect(page.getByRole('heading', { name: /Seção 1 — Capítulos 1 a 5/i })).toBeVisible();
  await expect(page.locator('#chapter-list .chapter-item')).toHaveCount(10);
});
