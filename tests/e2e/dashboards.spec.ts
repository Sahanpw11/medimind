import { expect, test } from '@playwright/test';
import { login, shot } from './helpers';

test('patient dashboard shows live summary, next appointment and health snapshot', async ({ page }, info) => {
  await login(page, 'patient@demo.test');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello');
  await expect(page.getByTestId('stat-upcoming')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next appointment' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Health snapshot' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Systolic blood pressure' })).toHaveCount(0); // vitals charts were removed on purpose
  await shot(page, info, '02b-patient-dashboard');
});

test('admin dashboard has an operations section above the trends', async ({ page }, info) => {
  await login(page, 'admin@demo.test');
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
  await expect(page.getByTestId('stat-today')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today across the clinic' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Calendar utilisation' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Next 14 days' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trends' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Appointments per month' })).toBeVisible();
  await shot(page, info, '01b-admin-dashboard');
});
