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
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Como usar o Entrelinhas' }).click();
  await expect(page.getByRole('dialog', { name: 'Como usar o Entrelinhas' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Experimente a amostra');
  await expect(page.getByRole('dialog')).toContainText('não envia sua biblioteca importada para servidor');

  await page.getByRole('button', { name: 'Fechar ajuda' }).click();
  await expect(page.getByRole('dialog', { name: 'Como usar o Entrelinhas' })).not.toBeVisible();
});

test('serves and plays the Dom Casmurro sample audio', async ({ page, request }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('entrelinhas.theme.v1', 'light');
    localStorage.setItem('entrelinhas.focus.v1', 'off');
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
        audio.addEventListener('loadedmetadata', () => {
          resolve({
            path: chapter.audio,
            duration: audio.duration,
            expectedDuration: chapter.durationSeconds,
          });
          cleanup();
        }, { once: true });
        audio.addEventListener('error', () => {
          resolve({
            path: chapter.audio,
            error: audio.error ? audio.error.code : 'unknown',
          });
          cleanup();
        }, { once: true });
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
      `${item.path} metadata duration should match catalog estimate`,
    ).toBeLessThan(30);
  }

  await expect(page.getByRole('heading', { name: /Seção 1 — Capítulos 1 a 5/i })).toBeVisible();
  await page.locator('#audio').evaluate((audio) => {
    audio.muted = true;
    audio.currentTime = 0;
  });
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pausar');
  await page.waitForFunction(() => document.getElementById('audio').currentTime > 0.5, null, { timeout: 10_000 });
  const currentTime = await page.locator('#audio').evaluate((audio) => audio.currentTime);
  expect(currentTime).toBeGreaterThan(0.5);
});
