import { expect, test } from '@playwright/test';
import { createPlaywrightInbox } from '@gettemp-email/testing/playwright';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.skip('email verification for an application you are authorized to test', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const target = new URL(process.env.TARGET_APP_URL);
  if (target.protocol !== 'https:' || target.username || target.password)
    throw new Error('TARGET_APP_URL must use HTTPS without credentials.');
  const mail = createPlaywrightInbox(request);
  await mail.use(
    async (inbox, client) => {
      await page.goto(new URL('/register', target).href);
      await page.getByLabel('Email').fill(inbox.address);
      await page.getByRole('button', { name: /sign up/i }).click();

      const summary = await client.waitForMessage(inbox, {
        subjectIncludes: 'Verify',
        timeoutMs: 45_000,
      });
      const message = await client.readMessage(inbox, summary.id);
      const href = mail.verificationUrl(message, {
        expectedHostname: target.hostname,
        expectedPath: '/verify',
      });
      const destination = new URL(href);
      if (destination.origin !== target.origin || destination.pathname !== '/verify')
        throw new Error('Verification destination did not match the application.');
      await page.goto(href);
      if (new URL(page.url()).origin !== target.origin)
        throw new Error('Verification redirected outside the expected origin.');
      await expect(page.getByRole('heading', { name: 'Account verified' })).toBeVisible();
      // Adapt this to identity returned by server-side verification, not an echoed form value.
      await expect(page.getByTestId('verified-email')).toHaveText(inbox.address);
    },
    { ttlMinutes: 5 },
  );
});
