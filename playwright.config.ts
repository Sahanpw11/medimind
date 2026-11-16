import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const local = !process.env.BASE_URL; // against a deployed URL we start nothing

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: BASE, trace: 'retain-on-failure', screenshot: 'only-on-failure', serviceWorkers: 'allow' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // iPhone 14 viewport/UA on Chromium (only Chromium is installed); WebKit is not required for these checks.
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: local ? [
    { command: 'node --env-file=.env backend/server.js', url: 'http://localhost:4000/api/health', reuseExistingServer: true, timeout: 30_000 },
    { command: "node scripts/run-ai.js", url: "http://localhost:8000/health", reuseExistingServer: true, timeout: 30_000 },
    { command: 'npm run build -w frontend && npm run preview -w frontend', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120_000 },
  ] : undefined,
});
