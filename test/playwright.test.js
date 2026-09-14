import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { request as playwrightRequest } from 'playwright-core';
import { createPlaywrightInbox } from '../src/playwright.js';

const inbox = {
  inboxId: 'synthetic-inbox',
  address: 'current@example.test',
  accessToken: 'synthetic-capability',
};

async function fixture(t, handler) {
  const calls = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const call = {
      method: req.method,
      path: req.url,
      headers: req.headers,
      body: Buffer.concat(chunks).toString(),
    };
    calls.push(call);
    handler(call, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const request = await playwrightRequest.newContext();
  t.after(async () => {
    await request.dispose();
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  });
  const mail = createPlaywrightInbox(request, {
    apiKey: 'synthetic-account-key',
    apiOrigin: `http://127.0.0.1:${server.address().port}`,
  });
  return { mail, calls };
}

test('real Playwright APIResponse supports create/list/read/delete and separate credentials', async (t) => {
  const { mail, calls } = await fixture(t, (call, res) => {
    res.setHeader('content-type', 'application/json');
    if (call.method === 'POST') {
      res.writeHead(201);
      res.end(JSON.stringify(inbox));
    } else if (call.method === 'DELETE') {
      res.writeHead(204);
      res.end();
    } else if (call.path.endsWith('/messages'))
      res.end(JSON.stringify([{ id: 'message', subject: 'Verify' }]));
    else res.end(JSON.stringify({ id: 'message', safe_links: [] }));
  });
  await mail.use(
    async (created, client) => {
      assert.deepEqual(created, inbox);
      const summary = await client.waitForMessage(created, {
        subjectIncludes: 'Verify',
      });
      assert.equal((await client.readMessage(created, summary.id)).id, 'message');
    },
    { ttlMinutes: 5 },
  );
  assert.deepEqual(
    calls.map((c) => c.method),
    ['POST', 'GET', 'GET', 'DELETE'],
  );
  assert.deepEqual(JSON.parse(calls[0].body), { ttlMinutes: 5 });
  for (const call of calls)
    assert.equal(call.headers.authorization, 'Bearer synthetic-account-key');
  for (const call of calls.slice(1))
    assert.equal(call.headers['x-inbox-access-token'], inbox.accessToken);
});

test('real adapter cleans up after assertion failure and accepts already deleted inbox', async (t) => {
  const { mail, calls } = await fixture(t, (call, res) => {
    res.setHeader('content-type', 'application/json');
    res.writeHead(call.method === 'POST' ? 201 : 404);
    res.end(JSON.stringify(call.method === 'POST' ? inbox : { error: 'inbox_not_found' }));
  });
  await assert.rejects(
    mail.use(async () => {
      throw new Error('identity mismatch');
    }),
    /identity mismatch/,
  );
  assert.equal(calls.at(-1).method, 'DELETE');
});

test('real adapter preserves error status and retry header without exposing upstream body', async (t) => {
  const { mail } = await fixture(t, (_, res) => {
    res.writeHead(429, {
      'content-type': 'application/json',
      'retry-after': '7',
    });
    res.end(JSON.stringify({ error: 'quota_reached', private: 'DO_NOT_EXPOSE' }));
  });
  await assert.rejects(mail.client.status(), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.category, 'quota_reached');
    assert.equal(error.retryAfterSeconds, 7);
    assert.doesNotMatch(error.message, /DO_NOT_EXPOSE/);
    return true;
  });
});

test('real adapter stops waiting on abort without disposing a shared request context', async (t) => {
  const { mail } = await fixture(t, (call, res) => {
    if (call.path.endsWith('/status')) {
      res.end('{"plan":"developer"}');
      return;
    }
    // The test intentionally leaves this response pending; teardown closes it.
  });
  const started = Date.now();
  await assert.rejects(mail.client.waitForMessage(inbox, { timeoutMs: 60 }), {
    category: 'message_timeout',
  });
  assert.ok(Date.now() - started < 1_000);
  assert.equal((await mail.client.status()).plan, 'developer');
});

test('adapter awaits body bytes, releases APIResponse and bounds native request timeout', async () => {
  let disposed = false;
  const mail = createPlaywrightInbox(
    {
      fetch: async (_, options) => {
        assert.equal(options.timeout, 5_000);
        return {
          status: () => 201,
          headers: () => ({}),
          body: async () => {
            await sleep(5);
            return Buffer.from(JSON.stringify(inbox));
          },
          dispose: async () => {
            disposed = true;
          },
        };
      },
    },
    { apiKey: 'synthetic-account-key' },
  );
  assert.deepEqual(await mail.client.createInbox(), inbox);
  assert.equal(disposed, true);
});
