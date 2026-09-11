import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initProject } from '../src/init.js';

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gettemp-testing-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ devDependencies: { '@playwright/test': '^1.0.0' } }),
  );
  return directory;
}

test('init is dry-run by default', async (t) => {
  const directory = await fixture(t);
  const result = await initProject({ directory });
  assert.equal(result.mode, 'dry-run');
  assert.ok(result.files.every((file) => file.action === 'create'));
  await assert.rejects(readFile(path.join(directory, 'AGENTS.gettemp-email.md')));
});

test('init writes no secret and is idempotent', async (t) => {
  const directory = await fixture(t);
  const first = await initProject({ directory, write: true });
  assert.equal(first.mode, 'write');
  const env = await readFile(path.join(directory, '.env.gettemp-email.example'), 'utf8');
  assert.match(env, /REPLACE_WITH_YOUR_KEY/);
  assert.doesNotMatch(env, /gte_live_[A-Za-z0-9_-]{32,}/);
  const second = await initProject({ directory, write: true });
  assert.ok(second.files.every((file) => file.action === 'skip_existing'));
});

test('unsupported detected engines do not modify the project', async (t) => {
  const directory = await fixture(t);
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ devDependencies: { cypress: '^14.0.0' } }),
  );
  const result = await initProject({ directory, write: true });
  assert.equal(result.ok, false);
  assert.equal(result.category, 'engine_not_supported');
});
