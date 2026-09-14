import assert from 'node:assert/strict';
import { test as base, expect } from '@playwright/test';

export { expect };
export const test = base.extend({
  request: async ({}, use, info) => {
    const scenario = info.title.split(':')[1];
    const inbox = {
      inboxId: 'synthetic-inbox',
      address: 'current-run@example.test',
      accessToken: 'synthetic-capability',
    };
    let created = false;
    let cleanup = 0;
    const respond = (status, body) => ({
      status: () => status,
      headers: () => ({ 'content-type': 'application/json' }),
      body: async () => Buffer.from(body === null ? '' : JSON.stringify(body)),
      json: async () => body,
      dispose: async () => {},
    });
    const fetch = async (url, options = {}) => {
      assert.ok(url.startsWith('https://api.gettemp.email/v1/developer/'));
      const headers = new Headers(options.headers);
      assert.equal(headers.get('authorization'), 'Bearer synthetic-account-key');
      if (options.method === 'POST') {
        if (scenario === 'quota') return respond(429, { error: 'quota_reached' });
        created = true;
        return respond(201, inbox);
      }
      assert.equal(headers.get('x-inbox-access-token'), inbox.accessToken);
      if (options.method === 'DELETE') {
        cleanup++;
        return scenario === 'cleanup-failure'
          ? respond(503, { error: 'api_unavailable' })
          : respond(204, null);
      }
      if (url.endsWith('/messages'))
        return respond(200, [{ id: 'message', subject: 'Verify test account' }]);
      const safe = 'https://authorized-app.example.test/verify?token=synthetic';
      const links =
        scenario === 'ambiguous'
          ? [safe, safe + '2']
          : scenario === 'foreign-link'
            ? ['https://foreign.example.test/verify']
            : [safe];
      return respond(200, {
        id: 'message',
        safe_links: links.map((href) => ({
          href,
          classification: 'verification-likely',
        })),
      });
    };
    const request = {
      fetch,
      post: (url, opts) => fetch(url, { ...opts, method: 'POST' }),
      get: (url, opts) => fetch(url, { ...opts, method: 'GET' }),
      delete: (url, opts) => fetch(url, { ...opts, method: 'DELETE' }),
    };
    await use(request);
    await info.attach('qa-cleanup-checks', {
      body: JSON.stringify({ cleanupCorrect: cleanup === (created ? 1 : 0) }),
      contentType: 'application/json',
    });
    assert.equal(cleanup, created ? 1 : 0, 'Each created inbox must receive a cleanup attempt.');
  },
  browserGuards: [
    async ({ page }, use, info) => {
      const scenario = info.title.split(':')[1];
      const errors = {
        'wrong-account': /toHaveText/,
        ambiguous: /More than one verification link/,
        'foreign-link': /No (safe )?verification link/,
        quota: /HTTP 429/,
        'cleanup-failure': /HTTP 503/,
      };
      const saved = {
        key: process.env.GETTEMP_API_KEY,
        target: process.env.TARGET_APP_URL,
      };
      process.env.GETTEMP_API_KEY = 'synthetic-account-key';
      process.env.TARGET_APP_URL = 'https://authorized-app.example.test';
      let foreign = 0;
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== 'https://authorized-app.example.test') {
          foreign++;
          return route.abort();
        }
        let body;
        if (['/register', '/signup'].includes(url.pathname))
          body =
            '<form action="/pending"><label>Email address<input name="email" type="email"></label><button>Create account / Sign up</button></form>';
        else if (url.pathname === '/pending') body = '<h1>Check your inbox</h1>';
        else if (url.pathname === '/verify')
          body =
            '<h1>Account verified</h1><div data-testid="verified-email">' +
            (scenario === 'wrong-account'
              ? 'previous-run@example.test'
              : 'current-run@example.test') +
            '</div>';
        else {
          foreign++;
          return route.abort();
        }
        return route.fulfill({ status: 200, contentType: 'text/html', body });
      });
      if (errors[scenario])
        info.fail(true, 'Deliberate negative case must fail at the intended guard.');
      try {
        await use();
        await info.attach('qa-browser-checks', {
          body: JSON.stringify({
            noForeignNavigation: foreign === 0,
            expectedErrorObserved: errors[scenario]
              ? errors[scenario].test(info.errors.map((error) => error.message).join('\n'))
              : info.errors.length === 0,
            identityMismatchObserved:
              scenario !== 'wrong-account' ||
              (await page.getByTestId('verified-email').textContent()) ===
                'previous-run@example.test',
          }),
          contentType: 'application/json',
        });
        assert.equal(foreign, 0);
        if (errors[scenario])
          assert.match(info.errors.map((error) => error.message).join('\n'), errors[scenario]);
        else assert.equal(info.errors.length, 0);
        if (scenario === 'wrong-account')
          assert.equal(
            await page.getByTestId('verified-email').textContent(),
            'previous-run@example.test',
          );
      } finally {
        for (const [name, value] of [
          ['GETTEMP_API_KEY', saved.key],
          ['TARGET_APP_URL', saved.target],
        ]) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
    },
    { auto: true },
  ],
});
