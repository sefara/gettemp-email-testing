import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const exec = promisify(execFile);

test('mcp-config contains no credential', async () => {
  const { stdout } = await exec(process.execPath, ['src/cli.js', 'mcp-config']);
  assert.match(stdout, /https:\/\/api\.gettemp\.email\/mcp/);
  assert.match(stdout, /\$\{GETTEMP_API_KEY\}/);
  assert.doesNotMatch(stdout, /gte_live_/);
});

test('help names safe init and doctor modes', async () => {
  const { stdout } = await exec(process.execPath, ['src/cli.js', '--help']);
  assert.match(stdout, /Preview generated files by default/);
  assert.match(stdout, /create and delete one empty inbox/);
});
