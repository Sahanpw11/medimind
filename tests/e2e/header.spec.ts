import { expect, test } from '@playwright/test';
import { login, shot } from './helpers';

test('top header replaces the sidebar: nav, search, New menu and notifications', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile';
  await login(page, 'patient@demo.test');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello');
  await expect(page.locator('aside, .sidebar')).toHaveCount(0);

  if (mobile) {
    await expect(page.locator('.hnav')).toBeHidden();
    await expect(page.locator('.tabbar')).toBeVisible();
    await shot(page, info, '13-header');
    return;
  }
  const nav = page.getByRole('navigation', { name: 'Main' }).first();
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Doctors' }).click();
  await expect(page).toHaveURL(/\/doctors$/);
  await expect(nav.getByRole('link', { name: 'Doctors' })).toHaveAttribute('aria-current', 'page');

  // Search: jump to a doctor search with the typed term
  const search = page.getByRole('searchbox', { name: 'Search or jump to a page' });
  await search.fill('Cardio');
  await expect(page.getByRole('option', { name: /Search doctors for "Cardio"/ })).toBeVisible();
  await search.press('Enter');
  await expect(page).toHaveURL(/\/doctors\?q=Cardio/);
  await expect(page.locator('a.doc-card').first()).toContainText('Cardiology');

  // New menu
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('link', { name: 'Ask the assistant' }).click();
  await expect(page).toHaveURL(/\/assistant$/);

  // Notifications: booking creates an unread one; marking read clears the badge
  const me = await page.request.get('/api/auth/me');
  expect(me.ok()).toBeTruthy();
  const bell = page.getByRole('button', { name: /^Notifications/ });
  const before = await page.request.get('/api/notifications');
  const unread0 = (await before.json()).unread as number;
  if (unread0 === 0) { // make sure there is something to read: book a far-future slot through the API
    // Find a genuinely free slot by asking the API (a random fixed-day slot collides after enough runs and 409s).
    const docs = await (await page.request.get('/api/doctors?limit=50')).json();
    const doc = docs.data.find((x: { availability: unknown[] }) => x.availability.length === 5); // works Mon to Fri
    let booked = false;
    for (let off = 150; off < 178 && !booked; off++) {
      const day = new Date(Date.now() + off * 864e5);
      if ([0, 6].includes(day.getUTCDay())) continue;
      const res = await (await page.request.get(`/api/doctors/${doc._id}/slots?date=${day.toISOString().slice(0, 10)}`)).json();
      const free = res.slots.find((s: { status: string }) => s.status === 'available');
      if (!free) continue;
      booked = (await page.request.post('/api/appointments', { data: { doctorId: doc._id, startAt: free.startAt, consultationType: 'online' } })).status() === 201;
    }
    expect(booked).toBe(true);
  }
  await page.reload();
  await expect(bell.locator('.badge')).toBeVisible();
  await bell.click();
  await shot(page, info, '13-header');
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(bell.locator('.badge')).toHaveCount(0);
});
