import { defineConfig } from '@playwright/test';
import path from 'node:path';

if (!process.env.GETTEMP_EXAMPLE_TEST_DIR) throw new Error('Run npm run test:browser.');
export default defineConfig({
  testDir: process.env.GETTEMP_EXAMPLE_TEST_DIR,
  testMatch: /(?:package|generated|website)-[a-z-]+\.spec\.js$/,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: path.join(process.env.GETTEMP_EXAMPLE_TEST_DIR, 'results.json'),
      },
    ],
  ],
  use: {
    browserName: 'chromium',
    launchOptions: process.env.GETTEMP_BROWSER_PATH
      ? { executablePath: process.env.GETTEMP_BROWSER_PATH }
      : {},
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
