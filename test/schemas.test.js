import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const schemaDirectory = path.resolve('schemas');
const expected = [
  'doctor.schema.json',
  'error.schema.json',
  'inbox.schema.json',
  'message-summary.schema.json',
  'message.schema.json',
  'status.schema.json',
];

test('shared contracts are versioned Draft 2020-12 JSON schemas', async () => {
  for (const filename of expected) {
    const schema = JSON.parse(await readFile(path.join(schemaDirectory, filename), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.match(schema.$id, /\/testing\/.+\.v1\.schema\.json$/);
    assert.ok(schema.title);
  }
});

test('doctor contract cannot contain inbox or message data', async () => {
  const schema = JSON.parse(
    await readFile(path.join(schemaDirectory, 'doctor.schema.json'), 'utf8'),
  );
  assert.deepEqual(Object.keys(schema.properties).sort(), ['ok', 'plan', 'status']);
  assert.equal(schema.additionalProperties, false);
});

test('manifest points to exact tagged JavaScript and Python installations', async () => {
  const manifest = JSON.parse(await readFile('integration-manifest.json', 'utf8'));
  assert.deepEqual(manifest.supported, ['playwright', 'pytest']);
  assert.match(manifest.install, /#v0\.2\.0$/);
  assert.match(manifest.python.install, /@v0\.2\.0#subdirectory=python$/);
  assert.equal(manifest.telemetry, 'none');
});
