import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(os.tmpdir(), 'gettemp-package-smoke-'));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run test:package.');
try {
  // Lifecycle output is not JSON. Verify first, then inspect a scripts-disabled archive.
  execFileSync(process.execPath, [npm, 'run', 'check'], { cwd: root, stdio: 'inherit' });
  const packed = JSON.parse(execFileSync(process.execPath, [
    npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 2_000_000 }));
  assert.equal(packed.length, 1);
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packed[0].version, version);
  for (const { path: entry } of packed[0].files) {
    assert.doesNotMatch(entry, /(?:^|\/)(?:node_modules|\.venv[^/]*|__pycache__|\.env)(?:\/|$)|\.py[co]$/);
  }
  const consumer = path.join(temporary, 'consumer');
  await mkdir(consumer);
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync(process.execPath, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund',
    path.join(temporary, packed[0].filename)], { cwd: consumer, stdio: 'pipe' });
  // Import the packed package's public exports, not source relative to this repository.
  const code = `
    import assert from 'node:assert/strict';
    import { GetTempClient } from '@gettemp-email/testing';
    import { createPlaywrightInbox } from '@gettemp-email/testing/playwright';
    const client = new GetTempClient({ apiKey: 'synthetic', fetch: async () => new Response('[]') });
    assert.equal(typeof client.waitForMessage, 'function');
    assert.equal(typeof createPlaywrightInbox, 'function');
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: consumer, stdio: 'pipe' });
  const cli = path.join(consumer, 'node_modules/@gettemp-email/testing/src/cli.js');
  const help = execFileSync(process.execPath, [cli, '--help'], { cwd: consumer, encoding: 'utf8' });
  assert.match(help, /doctor/);
  const init = JSON.parse(execFileSync(process.execPath,
    [cli, 'init', '--engine', 'playwright', '--write'], { cwd: consumer, encoding: 'utf8' }));
  assert.equal(init.ok, true);
  const example = await readFile(path.join(consumer, 'tests/email-verification.gettemp.example.spec.js'), 'utf8');
  assert.match(example, /intervalMs: 10_000/);
  assert.match(example, /test.skip\(/);
  console.log(JSON.stringify({ ok: true, version, packedFiles: packed[0].files.length,
    scope: 'local packed-package consumer; no live service calls', exports: true, cli: true, init: true }));
} finally {
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('gettemp-package-smoke-'));
  await rm(temporary, { recursive: true, force: true });
}
