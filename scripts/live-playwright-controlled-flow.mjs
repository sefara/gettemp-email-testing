import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { GetTempClient, verificationUrl } from '../src/index.js';

if (process.env.GETTEMP_LIVE_E2E_CONFIRM !== 'true')
  throw new Error('Set GETTEMP_LIVE_E2E_CONFIRM=true for one bounded production observation.');

const executableCandidates = [
  process.env.GETTEMP_BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

async function browserExecutable() {
  for (const candidate of executableCandidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // Continue through explicit system-browser candidates.
    }
  }
  throw new Error('No supported Chrome or Edge executable found.');
}

function smtpReader(socket) {
  let buffer = '';
  const pending = [];
  const ready = [];
  const flush = () => {
    while (pending.length && ready.length) pending.shift().resolve(ready.shift());
  };
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) if (/^\d{3} /.test(line)) ready.push(line);
    flush();
  });
  socket.on('error', (error) => {
    while (pending.length) pending.shift().reject(error);
  });
  return () =>
    ready.length
      ? Promise.resolve(ready.shift())
      : new Promise((resolve, reject) => pending.push({ resolve, reject }));
}

async function sendVerification(recipient, href) {
  const socket = createConnection({ host: 'route1.mx.cloudflare.net', port: 25 });
  socket.setTimeout(15_000, () => socket.destroy(new Error('smtp_timeout')));
  const read = smtpReader(socket);
  const command = async (value, expected) => {
    if (value) socket.write(`${value}\r\n`);
    const response = await read();
    if (!response.startsWith(String(expected))) throw new Error(`smtp_${response.slice(0, 3)}`);
  };
  try {
    await command(null, 220);
    await command('EHLO testing.gettemp.email', 250);
    await command('MAIL FROM:<verification-fixture@sender.invalid>', 250);
    await command(`RCPT TO:<${recipient}>`, 250);
    await command('DATA', 354);
    socket.write(
      [
        'From: Controlled test fixture <verification-fixture@sender.invalid>',
        `To: ${recipient}`,
        'Subject: Verify public connector fixture',
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${randomUUID()}@sender.invalid>`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        `<p>Controlled connector test.</p><p><a href="${href}">Verify test account</a></p>`,
        '.',
        '',
      ].join('\r\n'),
    );
    const accepted = await read();
    if (!accepted.startsWith('250')) throw new Error(`smtp_${accepted.slice(0, 3)}`);
    socket.write('QUIT\r\n');
  } finally {
    socket.end();
  }
}

async function fixtureServer() {
  const verificationToken = randomUUID();
  let verified = false;
  let origin = '';
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'GET' && url.pathname === '/signup') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(
        '<!doctype html><html lang="en"><title>Connector test</title><body><main><form method="post" action="/register"><label>Email <input name="email" type="email" required></label><button type="submit">Sign up</button></form></main></body></html>',
      );
      return;
    }
    if (request.method === 'POST' && url.pathname === '/register') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const recipient = new URLSearchParams(body).get('email') ?? '';
      if (!/^[^@\s]{1,64}@[^@\s]{1,253}$/.test(recipient)) {
        response.writeHead(400);
        response.end('Invalid input');
        return;
      }
      await sendVerification(
        recipient,
        `${origin}/verify?token=${encodeURIComponent(verificationToken)}`,
      );
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html><body><h1>Check your inbox</h1></body></html>');
      return;
    }
    if (request.method === 'GET' && url.pathname === '/verify') {
      if (url.searchParams.get('token') !== verificationToken) {
        response.writeHead(400);
        response.end('Invalid token');
        return;
      }
      verified = true;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html><body><h1>Account verified</h1></body></html>');
      return;
    }
    response.writeHead(404);
    response.end('Not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture_server_unavailable');
  origin = `http://127.0.0.1:${address.port}`;
  return { server, origin, isVerified: () => verified };
}

const client = new GetTempClient();
const fixture = await fixtureServer();
const browser = await chromium.launch({ executablePath: await browserExecutable(), headless: true });
try {
  await client.withInbox(
    async (inbox) => {
      const page = await browser.newPage();
      try {
        await page.goto(`${fixture.origin}/signup`);
        await page.getByLabel('Email').fill(inbox.address);
        await page.getByRole('button', { name: 'Sign up' }).click();
        await page.getByRole('heading', { name: 'Check your inbox' }).waitFor();
        const summary = await client.waitForMessage(inbox, {
          subjectIncludes: 'Verify public connector fixture',
          timeoutMs: 45_000,
        });
        const message = await client.readMessage(inbox, summary.id);
        const href = verificationUrl(message, {
          expectedHostname: '127.0.0.1',
          expectedPath: '/verify',
        });
        await page.goto(href);
        await page.getByRole('heading', { name: 'Account verified' }).waitFor();
        if (!fixture.isVerified()) throw new Error('fixture_verification_state_missing');
      } finally {
        await page.close();
      }
    },
    { ttlMinutes: 5 },
  );
  process.stdout.write(
    `${JSON.stringify({ ok: true, checks: 6, contentFree: true, cleanup: 'passed' })}\n`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => fixture.server.close(resolve));
}
