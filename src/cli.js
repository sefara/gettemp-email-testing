#!/usr/bin/env node
import { GetTempClient } from './client.js';
import { initProject } from './init.js';

function args(argv) {
  const [command = 'help', ...rest] = argv;
  const value = (name) => {
    const index = rest.indexOf(name);
    return index >= 0 ? rest[index + 1] : undefined;
  };
  return {
    command,
    write: rest.includes('--write'),
    statusOnly: rest.includes('--status-only'),
    engine: value('--engine'),
    directory: value('--directory'),
  };
}

function help() {
  return `gettemp-email-testing\n\nCommands:\n  init [--engine playwright] [--directory PATH] [--write]\n       Preview generated files by default. --write creates missing files only.\n  doctor [--status-only]\n       Verify the API key and, unless status-only, create and delete one empty inbox.\n  mcp-config\n       Print a secret-free generic Streamable HTTP MCP configuration.\n`;
}

async function main() {
  const options = args(process.argv.slice(2));
  if (options.command === 'help' || options.command === '--help' || options.command === '-h') {
    process.stdout.write(help());
    return;
  }
  if (options.command === 'init') {
    const result = await initProject(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 2;
    return;
  }
  if (options.command === 'doctor') {
    const result = await new GetTempClient().doctor(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (options.command === 'mcp-config') {
    process.stdout.write(
      `${JSON.stringify(
        {
          mcpServers: {
            'gettemp-email': {
              url: 'https://api.gettemp.email/mcp',
              headers: { Authorization: 'Bearer ${GETTEMP_API_KEY}' },
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  process.stderr.write(`Unknown command: ${options.command}\n\n${help()}`);
  process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ ok: false, category: error.category ?? 'unexpected_error', message: error.message })}\n`,
  );
  process.exitCode = 1;
});
