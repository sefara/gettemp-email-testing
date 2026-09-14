import assert from 'node:assert/strict';
import test from 'node:test';
import { GetTempClient } from '../src/client.js';

const inbox = {
  inboxId: '11111111-1111-4111-8111-111111111111',
  address: 'sample@gettempemail.online',
  accessToken: 'capability-token',
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('client separates account authorization from inbox capability', async () => {
  const calls = [];
  const client = new GetTempClient({
    apiKey: 'gte_live_test_value',
    fetch: async (url, options) => {
      calls.push({ url, options });
      return json([]);
    },
  });
  await client.listMessages(inbox);
  const headers = calls[0].options.headers;
  assert.equal(headers.get('authorization'), 'Bearer gte_live_test_value');
  assert.equal(headers.get('x-inbox-access-token'), 'capability-token');
  assert.doesNotMatch(calls[0].url, /capability-token|gte_live_test_value/);
});

test('request errors expose category and status but never response body', async () => {
  const client = new GetTempClient({
    apiKey: 'gte_live_test_value',
    fetch: async () => json({ error: 'quota_reached', sensitive: 'never expose me' }, 429),
  });
  await assert.rejects(client.status(), (error) => {
    assert.equal(error.category, 'quota_reached');
    assert.equal(error.status, 429);
    assert.doesNotMatch(error.message, /never expose me/);
    return true;
  });
});

test('untrusted server error categories cannot become diagnostic output', async () => {
  const client = new GetTempClient({
    apiKey: 'gte_live_test_value',
    fetch: async () => json({ error: 'secret value from body' }, 500),
  });
  await assert.rejects(client.status(), (error) => {
    assert.equal(error.category, 'request_failed');
    assert.doesNotMatch(error.message, /secret value/);
    return true;
  });
});

test('withInbox always deletes the inbox after a failed assertion', async () => {
  const methods = [];
  const client = new GetTempClient({
    apiKey: 'gte_live_test_value',
    fetch: async (_url, options) => {
      methods.push(options.method);
      if (options.method === 'POST') return json(inbox, 201);
      if (options.method === 'DELETE') return new Response(null, { status: 204 });
      throw new Error('unexpected call');
    },
  });
  await assert.rejects(
    client.withInbox(async () => {
      throw new Error('test failed');
    }),
    /test failed/,
  );
  assert.deepEqual(methods, ['POST', 'DELETE']);
});

test('doctor returns only a redacted result and performs status/create/delete', async () => {
  const paths = [];
  const client = new GetTempClient({
    apiKey: 'gte_live_secret_that_must_not_leak',
    fetch: async (url, options) => {
      paths.push([new URL(url).pathname, options.method]);
      if (url.endsWith('/status')) return json({ plan: 'developer', quota: { remainingDay: 10 } });
      if (options.method === 'POST') return json(inbox, 201);
      return new Response(null, { status: 204 });
    },
  });
  const result = await client.doctor();
  assert.deepEqual(result, {
    ok: true,
    status: 'create_delete_passed',
    plan: 'developer',
  });
  assert.doesNotMatch(JSON.stringify(result), /secret|sample@|11111111/);
  assert.deepEqual(paths, [
    ['/v1/developer/status', 'GET'],
    ['/v1/developer/inboxes', 'POST'],
    ['/v1/developer/inboxes/11111111-1111-4111-8111-111111111111', 'DELETE'],
  ]);
});

test('apiOrigin rejects credentials, paths and insecure remote HTTP', () => {
  for (const apiOrigin of [
    'https://user:pass@example.test',
    'https://example.test/path',
    'http://example.test',
  ]) {
    assert.throws(() => new GetTempClient({ apiKey: 'x', apiOrigin, fetch }));
  }
});

test('malformed successful JSON is redacted instead of leaking response fragments', async () => {
  const client = new GetTempClient({
    apiKey: 'synthetic',
    fetch: async () => new Response('PRIVATE_MAIL_FRAGMENT'),
  });
  await assert.rejects(client.status(), (error) => {
    assert.equal(error.category, 'invalid_response');
    assert.doesNotMatch(error.message, /PRIVATE_MAIL_FRAGMENT/);
    return true;
  });
});

test('poll deadline also bounds a stalled fetch request', async () => {
  const client = new GetTempClient({
    apiKey: 'synthetic',
    fetch: async (_, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      }),
  });
  // Keep the event loop alive while testing AbortSignal.timeout (its timer is unref'd).
  const keepAlive = setInterval(() => {}, 100);
  try {
    const started = Date.now();
    await assert.rejects(client.waitForMessage(inbox, { timeoutMs: 40 }), {
      category: 'message_timeout',
    });
    assert.ok(Date.now() - started < 1_000);
  } finally {
    clearInterval(keepAlive);
  }
});

test('caller abort interrupts the polling sleep', async () => {
  const controller = new AbortController();
  const client = new GetTempClient({
    apiKey: 'synthetic',
    fetch: async () => {
      setTimeout(() => controller.abort(), 10);
      return json([]);
    },
  });
  const started = Date.now();
  await assert.rejects(
    client.waitForMessage(inbox, {
      signal: controller.signal,
      intervalMs: 5_000,
    }),
  );
  assert.ok(Date.now() - started < 1_000);
});
