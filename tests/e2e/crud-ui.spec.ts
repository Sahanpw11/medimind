import { expect, test } from '@playwright/test';
import { login, logout } from './helpers';

test('a patient can upload and then delete their own document', async ({ page }, info) => {
  const reg = await page.request.post('/api/auth/register', { data: { email: `crud.${Date.now()}.${info.project.name}@demo.test`, password: 'Passw0rd!x', fullName: 'Crud Tester', dateOfBirth: '1990-05-05' } });
  const pid = (await reg.json()).user.profileId;
  await page.request.put(`/api/patients/${pid}`, { data: { onboardingDone: true } });

  await page.goto('/documents');
  await page.getByLabel(/Choose a file/).setInputFiles({ name: 'to-delete.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic') });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('to-delete.txt')).toBeVisible();

  await page.getByRole('button', { name: 'Delete to-delete.txt' }).click();
  await page.getByRole('button', { name: 'Keep' }).click(); // cancelling keeps it
  await expect(page.getByText('to-delete.txt')).toBeVisible();
  await page.getByRole('button', { name: 'Delete to-delete.txt' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByText('to-delete.txt')).toHaveCount(0);
  await expect(page.getByText('No documents yet')).toBeVisible();
});

test('an admin can delete a doctor with no history, and is refused for one who has history', async ({ page }, info) => {
  await login(page, 'admin@demo.test');
  await page.goto('/admin/doctors');
  const name = `Dr. Temp ${info.project.name} ${Date.now() % 100000}`;
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Specialty', { exact: true }).last().fill('Cardiology');
  await page.getByLabel('Login email').fill(`temp.${Date.now()}.${info.project.name}@demo.test`);
  await page.getByLabel('Temporary password').fill('Passw0rd!x');
  await page.getByRole('button', { name: 'Add doctor' }).click();
  await expect(page.getByText('Doctor added to the directory.')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(name);
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Delete doctor' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);

  // A seeded doctor has appointment history: the server refuses and the UI says why.
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('');
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByRole('button', { name: 'Delete doctor' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByText(/appointment history and cannot be deleted/)).toBeVisible();
  await logout(page);
});
