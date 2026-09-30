import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}`

/**
 * Tags that decide which engines a spec runs on.
 *
 * `@input` is the exception ADR-0009 carves out of "a lane may iterate on Chromium": research 06
 * found Firefox ignores `preventDefault()` on `beforeinput`, so a Chromium-only green run on the
 * keystroke path would be misleading rather than merely weaker. Input-path specs therefore run on
 * all three engines from their first commit — `pnpm test:e2e:input`.
 *
 * `@cdp` is Chromium-only forever: simulating a physical ЙЦУКЕН layout needs the Chrome DevTools
 * Protocol, because Playwright's keyboard API cannot type Cyrillic in any engine.
 */
const CDP_ONLY = /@cdp/

export default defineConfig({
  testDir: './e2e',
  // Every scenario runs against the production build, per the Definition of Done.
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    stdout: 'pipe',
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  expect: {
    // Visual comparisons run with motion off, which is what makes them deterministic (FR-064).
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['latency.spec.ts'],
      grepInvert: CDP_ONLY,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: ['latency.spec.ts'],
      grepInvert: CDP_ONLY,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: ['latency.spec.ts'],
      grepInvert: CDP_ONLY,
    },
    {
      // The one thing Playwright genuinely cannot do without CDP: a physical ЙЦУКЕН layout.
      name: 'cdp',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['latency.spec.ts'],
      grep: CDP_ONLY,
    },
    {
      // Keystroke-to-paint, research R8. Frame-rate limiting and GPU vsync off, or the measurement
      // is capped by the compositor rather than by our code — and a capped number would flatter us.
      name: 'latency',
      testMatch: ['latency.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-frame-rate-limit',
            '--disable-gpu-vsync',
            '--disable-features=CalculateNativeWinOcclusion',
          ],
        },
      },
    },
  ],
})
