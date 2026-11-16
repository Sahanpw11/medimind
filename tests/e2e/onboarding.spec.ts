import { expect, test } from '@playwright/test';
import { login, shot } from './helpers';

async function register(page: import('@playwright/test').Page, tag: string, name: string) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(`onb.${Date.now()}.${tag}@demo.test`);
  await page.getByLabel('Date of birth').fill('1992-08-14');
  await page.getByLabel('Password').fill('Passw0rd!x');
  await page.getByRole('button', { name: 'Create account' }).click();
}

test('a new patient is guided through three steps, and what they enter is saved', async ({ page }, info) => {
  await register(page, info.project.name, 'Nimali Silva');
  await expect(page.getByRole('heading', { name: 'Welcome, Nimali' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'About you' })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Allergies: Continue stays disabled until they either add one or say they have none
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByLabel('I have no known allergies').check();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'About you', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Emergency contact is required to finish
  await expect(page.getByRole('button', { name: 'Finish' })).toBeDisabled();
  await page.getByLabel('Contact name').fill('Sunil Silva');
  await page.getByLabel('Relationship').fill('Father');
  await shot(page, info, '15-onboarding');
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello, Nimali');
  await expect(page.getByText('Sunil Silva, Father')).toBeVisible();

  await page.reload(); // finished once: never asked again
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello, Nimali');
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/$/);
});

test('onboarding can be skipped, and the patient is not asked again', async ({ page }, info) => {
  await register(page, info.project.name + 's', 'Ravi Perera');
  await expect(page.getByRole('heading', { name: 'Welcome, Ravi' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello, Ravi');
  await page.goto('/doctors');
  await expect(page.getByRole('heading', { name: 'Find a doctor' })).toBeVisible(); // not bounced back to /welcome
});

test('existing seeded patients are never sent to onboarding', async ({ page }) => {
  await login(page, 'patient@demo.test');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello');
  await expect(page).not.toHaveURL(/welcome/);
});
