import { expect, type Page, type TestInfo } from '@playwright/test';
import * as path from 'path';

export const SHOTS = path.join(__dirname, '..', '..', 'docs', 'evidence', 'screenshots');
export const shot = async (page: Page, info: TestInfo, name: string) => { await page.waitForTimeout(450); /* let 200ms transitions settle */ return page.screenshot({ path: path.join(SHOTS, `${info.project.name}-${name}.png`), fullPage: false }); };

export async function login(page: Page, email: string, password = 'Demo@12345') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/); // signed in: cookies are set before the next navigation
}
export async function logout(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Open the first doctor from search and return the page on a day with free slots. */
export async function pickRandomFreeSlot(page: Page) {
  const slots = page.getByRole('group', { name: 'Available times' }).getByRole('button');
  await expect(slots.first()).toBeVisible();
  const enabled = slots.and(page.locator(':not([disabled])'));
  await expect(enabled.first()).toBeVisible(); // the day auto-advances past days with no free slot; wait for it
  const n = await enabled.count();
  expect(n).toBeGreaterThan(0);
  const i = Math.floor(Math.random() * n);
  const btn = enabled.nth(i);
  await btn.click();
  return btn;
}
