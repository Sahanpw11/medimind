import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.use({ serviceWorkers: 'block' }); // page.route cannot see requests that pass through the service worker

// Regression for a flaky booking-conflict test. Slot data is mocked so the scenario is deterministic:
// the slot the user picked is the LAST free slot of the day, and someone else takes it first.
test('when the last free slot is taken, the grid stays on the same day and shows it as booked', async ({ page }) => {
  await login(page, 'patient@demo.test');
  const docs = await (await page.request.get('/api/doctors?limit=50')).json();
  const doc = docs.data.find((d: { availability: unknown[] }) => d.availability.length === 5);

  let firstDate = '', taken = false;
  const slot = (date: string, hhmm: string, status: string) => ({ startAt: `${date}T${hhmm}:00.000Z`, endAt: `${date}T${hhmm}:30.000Z`, status });
  await page.route(/\/api\/doctors\/[^/]+\/slots\?/, async (route) => {
    const date = new URL(route.request().url()).searchParams.get('date')!;
    if (!firstDate) firstDate = date;
    const slots = date === firstDate
      ? [slot(date, '09:00', taken ? 'taken' : 'available'), slot(date, '09:30', 'taken')]
      : [slot(date, '09:00', 'available'), slot(date, '09:30', 'available')];
    await route.fulfill({ json: { date, slots } });
  });
  await page.route(/\/api\/appointments$/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    taken = true; // somebody else got it first
    await route.fulfill({ status: 409, json: { error: 'That time slot has just been taken. Please choose another.' } });
  });

  await page.goto(`/doctors/${doc._id}`);
  const pressedDay = page.locator('.date-strip button[aria-pressed="true"]');
  await expect(page.getByRole('button', { name: '09:00', exact: true })).toBeEnabled();
  const dayBefore = await pressedDay.getAttribute('aria-label');

  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await page.getByRole('button', { name: 'Book appointment' }).click();
  await expect(page.getByText('That time was just taken')).toBeVisible();

  // The user must still be looking at the same day, with their slot now shown as booked.
  await expect(page.getByRole('button', { name: '09:00, already booked' })).toBeDisabled();
  await expect(pressedDay).toHaveAttribute('aria-label', dayBefore!);
});
