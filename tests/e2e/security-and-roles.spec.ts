import { expect, test } from '@playwright/test';
import { login, pickRandomFreeSlot, shot } from './helpers';

test('unauthenticated users are sent to sign in; invalid credentials show an error', async ({ page }) => {
  await page.goto('/appointments');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email').fill('patient@demo.test');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
});

test('a patient cannot open admin or doctor screens', async ({ page }) => {
  await login(page, 'patient@demo.test');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello');
  for (const p of ['/admin', '/admin/doctors', '/schedule']) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/$/);
  }
});

test("a patient's API call to another patient's records is forbidden", async ({ page }) => {
  await login(page, 'patient@demo.test');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello');
  const res = await page.request.get('/api/medical-records/patient/020000000000000000000002');
  expect(res.status()).toBe(403);
  const adm = await page.request.get('/api/analytics/overview');
  expect(adm.status()).toBe(403);
});

test('doctor lands on a dashboard with live metrics, then manages appointments', async ({ page }, info) => {
  await login(page, 'doctor@demo.test');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByTestId('stat-today')).toBeVisible();
  await expect(page.getByRole('heading', { name: "Today's agenda" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next patient' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs confirmation' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Next 14 days' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent outcomes' })).toBeVisible();
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
  await shot(page, info, '09-doctor-dashboard');

  await page.goto('/schedule');
  await expect(page.getByRole('heading', { name: 'Appointments', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Past' }).click();
  const first = page.getByRole('button', { name: 'Manage' }).first();
  await expect(first).toBeVisible();
  await first.click();
  await shot(page, info, '10-doctor-appointments');
  await page.getByRole('link', { name: 'Visit record' }).first().click();
  await expect(page.getByRole('heading', { name: 'Visit record', level: 1 })).toBeVisible();
  await expect(page.getByText('Earlier records', { exact: true })).toBeVisible();
  await shot(page, info, '10b-visit-record');
});

test('a slot taken by someone else mid-booking shows a plain-language conflict and refreshes the grid', async ({ page, browser }, info) => {
  await login(page, 'patient@demo.test');
  await page.goto('/doctors');
  await page.locator('a.doc-card').first().click();
  const chosen = await pickRandomFreeSlot(page);
  const label = (await chosen.getAttribute('aria-label')) ?? '';

  // Another patient grabs the same slot through the API first.
  const ctx = await browser.newContext({ baseURL: info.project.use.baseURL });
  const r = ctx.request;
  expect((await r.post('/api/auth/login', { data: { email: 'patient2@demo.test', password: 'Demo@12345' } })).ok()).toBeTruthy();
  const docId = page.url().split('/doctors/')[1];
  const date = await page.locator('.date-strip button[aria-pressed="true"]').getAttribute('aria-label');
  expect(date).toBeTruthy();
  const slots = await (await ctx.request.get(`/api/doctors/${docId}/slots?date=${await dayKey(page)}`)).json();
  const startAt = slots.slots.find((s: { startAt: string }) => label.startsWith(new Date(s.startAt).toISOString().slice(11, 16)))?.startAt;
  expect(startAt).toBeTruthy();
  const booked = await r.post('/api/appointments', { data: { doctorId: docId, startAt, consultationType: 'in_person' } });
  expect(booked.status()).toBe(201);
  await ctx.close();

  await page.getByRole('button', { name: 'Book appointment' }).click();
  await expect(page.getByText('That time was just taken')).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${label.slice(0, 5)}.*already booked`) })).toBeDisabled();
  await shot(page, info, '11-booking-conflict');
});

async function dayKey(page: import('@playwright/test').Page) {
  // The date strip's pressed button carries the formatted date; recover ISO day from the slot request the page made.
  const reqUrl = await page.evaluate(() => (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((e) => e.name).filter((n) => n.includes('/slots?date=')).pop());
  return reqUrl!.split('date=')[1];
}
