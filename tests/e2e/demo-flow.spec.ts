import { expect, test } from '@playwright/test';
import { login, logout, pickRandomFreeSlot, shot } from './helpers';

// The brief's end-to-end demonstration, in order, with an aggregation-backed dashboard check at both ends.
test('patient journey is reflected in the admin analytics dashboard', async ({ page }, info) => {
  const total = async () => Number((await page.getByTestId('stat-appointments').innerText()).replace(/,/g, ''));

  // Admin baseline
  await login(page, 'admin@demo.test');
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Appointments per month' })).toBeVisible();
  const before = await total();
  await shot(page, info, '01-admin-dashboard');
  await logout(page);

  // Register
  const email = `e2e.${Date.now()}.${info.project.name}@demo.test`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Playwright Patient');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Date of birth').fill('1994-03-21');
  await page.getByLabel('Password').fill('Passw0rd!x');
  await page.getByRole('button', { name: 'Create account' }).click();

  // First-login onboarding: about you, allergies, emergency contact
  await expect(page.getByRole('heading', { name: 'Welcome, Playwright' })).toBeVisible();
  await page.getByLabel('Phone number').fill('0771234567');
  await page.getByLabel('City').fill('Colombo');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Add an allergy' }).click();
  await page.getByLabel('Allergy 1', { exact: true }).fill('Latex');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Contact name').fill('Kamal Perera');
  await page.getByLabel('Relationship').fill('Brother');
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello, Playwright');
  await expect(page.getByText('Latex, Mild')).toBeVisible(); // what they entered shows in the health snapshot
  await shot(page, info, '02-patient-home');

  // Search a doctor
  await page.getByRole('link', { name: 'Find a doctor' }).first().click();
  await page.getByLabel('Specialty').selectOption('Cardiology');
  const doc = page.locator('a.doc-card').first();
  await expect(doc).toBeVisible();
  await shot(page, info, '03-doctor-search');
  await doc.click();

  // Book
  await expect(page.getByRole('heading', { name: 'Choose a time (UTC)' })).toBeVisible();
  await pickRandomFreeSlot(page);
  await shot(page, info, '04-booking');
  await page.getByRole('button', { name: 'Book appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Appointment booked' })).toBeVisible();
  await shot(page, info, '05-booked');

  // History shows the booking
  await page.getByRole('link', { name: 'View my visits' }).click();
  await expect(page.locator('table tbody tr').first()).toContainText('Booked');

  // Medical history (new patient: empty state, not an error)
  await page.goto('/records');
  await expect(page.getByText('No records yet')).toBeVisible();

  // Upload a synthetic document and see its metadata
  await page.goto('/documents');
  await page.getByLabel(/Choose a file/).setInputFiles({ name: 'synthetic-lab.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic demo lab result. Not real.') });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('Uploaded. Your file is stored privately.')).toBeVisible();
  await expect(page.getByText('synthetic-lab.txt')).toBeVisible();
  await expect(page.getByText(/SHA-256 [0-9a-f]{12}/)).toBeVisible();
  await shot(page, info, '06-documents');

  // Ask the assistant: grounded answer with source and disclaimer
  await page.goto('/assistant');
  await page.getByLabel('Your question').fill('How many hours of sleep do adults need?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('seven to nine hours')).toBeVisible();
  await expect(page.getByText('EDU-12: Sleep health')).toBeVisible();
  await expect(page.locator('.bubble.bot').first().getByText(/Not medical advice/)).toBeVisible();
  await page.getByLabel('Your question').fill('Do I have diabetes because I feel thirsty?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText("I can't diagnose conditions")).toBeVisible();
  await shot(page, info, '07-assistant');
  await logout(page);

  // Admin dashboard reflects the new appointment
  await login(page, 'admin@demo.test');
  await expect(page.getByRole('heading', { name: 'Appointments per month' })).toBeVisible();
  await expect.poll(total).toBe(before + 1);
  for (const t of ['Appointments per month', 'How appointments end', 'Appointments by specialty', 'Busiest doctors', 'Most common diagnoses', 'Patients by age band']) {
    await expect(page.getByRole('region', { name: t })).toBeVisible();
  }
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
  await shot(page, info, '08-admin-dashboard-after');
});
