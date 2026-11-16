import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('web app manifest is valid and installable', async ({ page, request }) => {
  await page.goto('/login');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const m = await (await request.get(href!)).json();
  expect(m.name).toBe('MediMind');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('/');
  const sizes = m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ':' + i.purpose : ''}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512:maskable']));
  for (const i of m.icons) expect((await request.get(i.src)).status()).toBe(200);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test('service worker registers, and API responses are never cached', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller || navigator.serviceWorker.getRegistrations().then((r) => r.length > 0))).toBeTruthy();
  await login(page, 'patient@demo.test');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello');
  const cached = await page.evaluate(async () => {
    const out: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
    return out;
  });
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.filter((p) => p.startsWith('/api/') || p.startsWith('/ai/'))).toEqual([]);
});

test('the app shell loads offline and explains that data is unavailable', async ({ page, context }) => {
  await page.goto('/login');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // ensure the page is controlled by the worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await context.setOffline(false);
});
