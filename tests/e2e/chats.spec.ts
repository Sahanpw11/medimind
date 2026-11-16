import { expect, test } from '@playwright/test';
import { shot } from './helpers';

test('chats are kept: new chat, switch between chats, survive reload, delete', async ({ page }, info) => {
  const email = `chat.${Date.now()}.${info.project.name}@demo.test`;
  const reg = await page.request.post('/api/auth/register', { data: { email, password: 'Passw0rd!x', fullName: 'Chat Tester', dateOfBirth: '1990-05-05' } });
  expect(reg.ok()).toBeTruthy();
  const pid = (await reg.json()).user.profileId;
  expect((await page.request.put(`/api/patients/${pid}`, { data: { onboardingDone: true } })).ok()).toBeTruthy(); // skip the welcome flow

  const ask = async (q: string) => { await page.getByLabel('Your question').fill(q); await page.getByRole('button', { name: 'Send' }).click(); };
  const chat = page.getByRole('region', { name: 'Conversation' });
  const chatsCard = page.getByRole('region', { name: 'Chats' });

  await page.goto('/assistant');
  await expect(chatsCard.getByText('No earlier chats yet')).toBeVisible();
  await ask('What is a routine checkup?');
  await expect(chat.getByText('regular visit to a doctor')).toBeVisible();
  await expect(chatsCard.getByRole('button', { name: 'Open chat: What is a routine checkup?' })).toBeVisible();

  await page.getByRole('button', { name: 'New chat' }).click();
  await expect(chat.getByText('Ask a general question')).toBeVisible();
  await expect(chat.getByText('regular visit to a doctor')).toHaveCount(0);
  await ask('How much sleep do adults need?');
  await expect(chat.getByText('seven to nine hours')).toBeVisible();
  await expect(chatsCard.getByRole('button', { name: /^Open chat:/ })).toHaveCount(2);
  await shot(page, info, '14-chats');

  await chatsCard.getByRole('button', { name: 'Open chat: What is a routine checkup?' }).click();
  await expect(chat.getByText('regular visit to a doctor')).toBeVisible();
  await expect(chat.getByText('seven to nine hours')).toHaveCount(0);

  await page.reload(); // the selected chat is in the URL, so it comes back
  await expect(chat.getByText('regular visit to a doctor')).toBeVisible();

  await chatsCard.getByRole('button', { name: 'Delete chat: What is a routine checkup?' }).click();
  await chatsCard.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(chatsCard.getByRole('button', { name: /^Open chat:/ })).toHaveCount(1);
  await expect(chatsCard.getByRole('button', { name: 'Open chat: What is a routine checkup?' })).toHaveCount(0);
  await expect(chat.getByText('Ask a general question')).toBeVisible(); // deleted the open chat: fresh one starts
});
