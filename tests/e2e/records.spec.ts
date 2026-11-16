import { expect, test } from '@playwright/test';
import { login, shot } from './helpers';

test('a patient can open a visit record and see its full detail', async ({ page }, info) => {
  await login(page, 'patient@demo.test');
  await page.goto('/records');
  const first = page.getByRole('button', { name: /\d{4}/ }).filter({ has: page.locator('.row-title') }).first();
  await expect(first).toBeVisible();
  if (info.project.name === 'mobile') await first.click(); // phones show the list first, then the detail
  const detail = page.getByRole('article');
  await expect(detail.getByRole('heading', { name: 'Diagnoses' })).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'Vitals at this visit' })).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'Medications' })).toBeVisible();
  await expect(detail.getByRole('heading', { name: /Doctor.s notes/ })).toBeVisible();
  await shot(page, info, '12-record-detail');
  if (info.project.name === 'mobile') { await page.getByRole('button', { name: 'All records' }).click(); await expect(first).toBeVisible(); }
});
