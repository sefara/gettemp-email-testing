import { expect, test } from '@playwright/test';
import { createPlaywrightInbox } from '@gettemp-email/testing/playwright';

test.skip('email verification for an application you are authorized to test', async ({
  page,
  request,
}) => {
  const mail = createPlaywrightInbox(request);
  await mail.use(async (inbox, client) => {
    await page.goto('https://your-app.example/register');
    await page.getByLabel('Email').fill(inbox.address);
    await page.getByRole('button', { name: /sign up/i }).click();

    const summary = await client.waitForMessage(inbox, {
      subjectIncludes: 'Verify',
      timeoutMs: 45_000,
    });
    const message = await client.readMessage(inbox, summary.id);
    const href = mail.verificationUrl(message, {
      expectedHostname: 'your-app.example',
      expectedPath: '/verify',
    });
    await page.goto(href);
    await expect(page).toHaveURL(/verified/);
  }, { ttlMinutes: 5 });
});
