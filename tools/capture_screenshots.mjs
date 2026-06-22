import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs', 'screenshots');

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    localStorage.setItem('entrelinhas.theme.v1', 'light');
    localStorage.setItem('entrelinhas.focus.v1', 'off');
  });
  await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(output, 'desktop-light.png'), fullPage: true });

  await page.locator('#theme-toggle').click();
  await page.screenshot({ path: path.join(output, 'desktop-dark.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 1100 });
  await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(output, 'mobile-light.png'), fullPage: true });
  await browser.close();
  console.log(`Screenshots saved to ${path.relative(root, output)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
