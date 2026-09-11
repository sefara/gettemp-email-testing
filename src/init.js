import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const engines = ['playwright', 'cypress', 'vitest', 'jest'];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function detectEngine(directory) {
  let packageJson = {};
  try {
    packageJson = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if (dependencies['@playwright/test'] || dependencies.playwright) return 'playwright';
  return engines.find((engine) => dependencies[engine]) ?? null;
}

function generatedFiles(engine) {
  const helper = `import { createPlaywrightInbox } from '@gettemp-email/testing/playwright';\n\nexport const temporaryEmail = (request) => createPlaywrightInbox(request);\n`;
  const example = `import { expect, test } from '@playwright/test';\nimport { temporaryEmail } from './helpers/gettemp-email.js';\n\ntest.skip('replace with an application you own or are authorized to test', async ({ page, request }) => {\n  const mail = temporaryEmail(request);\n  await mail.use(async (inbox, client) => {\n    await page.goto('https://your-app.example/register');\n    await page.getByLabel('Email').fill(inbox.address);\n    await page.getByRole('button', { name: /sign up/i }).click();\n\n    const summary = await client.waitForMessage(inbox, { subjectIncludes: 'Verify' });\n    const message = await client.readMessage(inbox, summary.id);\n    const href = mail.verificationUrl(message, { expectedHostname: 'your-app.example' });\n    await page.goto(href);\n    await expect(page).toHaveURL(/verified/);\n  }, { ttlMinutes: 5 });\n});\n`;
  const agent = `# gettemp.email test integration\n\n- Use only for an application the user owns or is authorized to test.\n- Read the API key from GETTEMP_API_KEY; never print it or commit it.\n- Always delete each temporary inbox in teardown/finally.\n- Never follow a verification link unless HTTPS and exact expected hostname checks pass.\n- Do not automate bulk account creation, free-trial abuse, spam, or third-party ban evasion.\n`;
  const env = 'GETTEMP_API_KEY=gte_live_REPLACE_WITH_YOUR_KEY\n';
  if (engine !== 'playwright') return null;
  return [
    ['tests/helpers/gettemp-email.js', helper],
    ['tests/email-verification.gettemp.example.spec.js', example],
    ['AGENTS.gettemp-email.md', agent],
    ['.env.gettemp-email.example', env],
  ];
}

export async function initProject(options = {}) {
  const directory = path.resolve(options.directory ?? process.cwd());
  const engine = options.engine ?? (await detectEngine(directory));
  if (!engine)
    return { ok: false, category: 'engine_not_detected', directory, supported: ['playwright'] };
  const files = generatedFiles(engine);
  if (!files)
    return { ok: false, category: 'engine_not_supported', engine, supported: ['playwright'] };

  const plan = [];
  for (const [relativePath, content] of files) {
    const target = path.join(directory, relativePath);
    plan.push({ relativePath, action: (await exists(target)) ? 'skip_existing' : 'create', target, content });
  }

  if (options.write) {
    for (const item of plan) {
      if (item.action !== 'create') continue;
      await mkdir(path.dirname(item.target), { recursive: true });
      await writeFile(item.target, item.content, { encoding: 'utf8', flag: 'wx' });
    }
  }
  return {
    ok: true,
    engine,
    mode: options.write ? 'write' : 'dry-run',
    files: plan.map(({ relativePath, action }) => ({ relativePath, action })),
  };
}
