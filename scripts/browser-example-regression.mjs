import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initProject } from '../src/init.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const generated = await mkdtemp(path.join(root, '.browser-qa-'));
try {
  const sources = [
    [
      'package',
      await readFile(path.join(root, 'examples/playwright/email-verification.spec.js'), 'utf8'),
    ],
  ];
  await initProject({
    directory: generated,
    engine: 'playwright',
    write: true,
  });
  sources.push([
    'generated',
    await readFile(
      path.join(generated, 'tests/email-verification.gettemp.example.spec.js'),
      'utf8',
    ),
  ]);
  // Optional local website source: verify its executable JS without changing or publishing its article.
  if (process.env.GETTEMP_GUIDE_DIRECTORY) {
    const guide = path.resolve(process.env.GETTEMP_GUIDE_DIRECTORY);
    sources.push([
      'website',
      await readFile(path.join(guide, 'email-verification.example.js'), 'utf8'),
    ]);
    await writeFile(
      path.join(generated, 'temporary-inbox.js'),
      await readFile(path.join(guide, 'temporary-inbox.js')),
    );
  }
  for (const [kind, source] of sources) {
    assert.match(source, /from ['"]@playwright\/test['"]/);
    assert.match(source, /getByTestId\(['"]verified-email['"]\)/);
    for (const scenario of [
      'success',
      'wrong-account',
      'ambiguous',
      'foreign-link',
      'quota',
      'cleanup-failure',
    ]) {
      let code = source
        .replace(/from ['"]@playwright\/test['"]/, "from '../qa/browser/fixture.js'")
        .replace(
          /from ['"]\.\/helpers\/gettemp-email.js['"]/,
          "from './tests/helpers/gettemp-email.js'",
        )
        .replace('test.skip(', 'test(');
      code = code.replace(/test\(\s*(['"])[^'"]*\1/, `test('${kind}:${scenario}'`);
      await writeFile(path.join(generated, `${kind}-${scenario}.spec.js`), code);
    }
  }
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(root, 'node_modules/@playwright/test/cli.js'),
        'test',
        '--config',
        'qa/browser/playwright.config.js',
      ],
      {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, GETTEMP_EXAMPLE_TEST_DIR: generated },
      },
    );
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = result;
  const report = JSON.parse(await readFile(path.join(generated, 'results.json'), 'utf8'));
  assert.equal(report.stats.unexpected, 0);
  assert.equal(report.stats.skipped, 0);
  let checked = 0;
  const visit = (suite) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests) {
        assert.equal(test.status, 'expected');
        for (const result of test.results)
          for (const name of ['qa-browser-checks', 'qa-cleanup-checks']) {
            const attachment = result.attachments.find((item) => item.name === name);
            assert.ok(attachment?.body, `Missing independent receipt: ${spec.title} / ${name}`);
            const receipt = JSON.parse(Buffer.from(attachment.body, 'base64').toString());
            for (const [check, value] of Object.entries(receipt))
              assert.equal(value, true, `${spec.title}: ${check}`);
          }
        checked++;
      }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites) visit(suite);
  assert.equal(checked, sources.length * 6);
  console.log(
    JSON.stringify({
      ok: true,
      checked,
      scope: 'synthetic browser examples; no live email',
      independentReceipts: true,
    }),
  );
} finally {
  // Delete only the newly allocated, validated QA directory, never a user-supplied path.
  assert.equal(path.dirname(generated), path.resolve(root));
  assert.ok(path.basename(generated).startsWith('.browser-qa-'));
  await rm(generated, { recursive: true, force: true });
}
