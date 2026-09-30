import { expect, test } from '@playwright/test'
import { seedStore } from './harness/fixtures.js'
import { typeChar, typingSurface } from './harness/type.js'

/**
 * T071. The keystroke-to-paint gate — FR-070, SC-002, research R8.
 *
 * 200 keystrokes, p95 at most 16 ms, in the `latency` Playwright project: Chromium alone, with
 * frame-rate limiting and GPU vsync disabled. Without those flags the measurement is capped by the
 * compositor rather than by our code, and the number would say more about the display than about
 * the application.
 *
 * What is measured is a **deliberate upper bound** (R8): `t1` is taken in a macrotask after the
 * next animation frame, which runs strictly later than the commit. So the gate can fail a frame
 * that actually made it and cannot pass one that did not. That asymmetry is the point — a
 * regression gate that flatters us is worse than no gate.
 *
 * The probe ships dead in production, so this spec needs a build with `VITE_LATENCY_PROBE=true`
 * or the dev server. It skips, loudly, rather than passing vacuously when the probe is absent.
 */

const KEYSTROKES = 200
const BUDGET_MS = 16

test('keystroke-to-paint stays inside the 16 ms budget at p95', async ({ page }) => {
  await seedStore(page, {
    settings: {
      theme: 'light',
      motion: 'off',
      sound: 'off',
      textSizePx: 28,
      errorMode: 'freeBackspace',
      typingLanguage: 'uk',
      layoutId: 'yq',
      interfaceLanguage: 'uk',
    },
  })

  await page.goto('/today')

  const probePresent = await page.evaluate(() => window.__typingRaceLatency !== undefined)
  test.skip(
    !probePresent,
    'The latency probe is compiled out of this build. Run against the dev server, or build with VITE_LATENCY_PROBE=true.',
  )

  // Reach a typing surface. The route is stable; which scale it opens is not part of this gate.
  await page
    .getByRole('link', { name: /вправ|exercise|практ|practi/i })
    .first()
    .click()
  await expect(typingSurface(page)).toBeAttached()

  await page.evaluate(() => {
    window.__typingRaceLatency?.startLatencyProbe()
  })

  // Free correction, so a wrong character never stops the run: this spec measures paint latency,
  // not judging. The characters themselves are irrelevant — only that each is one real keystroke.
  for (let i = 0; i < KEYSTROKES; i += 1) {
    await typeChar(page, 'ф')
  }

  // The macrotask that carries `t1` lags the keystroke by at least a frame, so the last samples
  // are still in flight when the loop ends. Wait for the count rather than for a fixed delay.
  await expect
    .poll(
      async () => page.evaluate(() => window.__typingRaceLatency?.readLatencyReport().samples ?? 0),
      {
        timeout: 15_000,
      },
    )
    .toBeGreaterThanOrEqual(KEYSTROKES)

  const report = await page.evaluate(() => window.__typingRaceLatency?.readLatencyReport())
  expect(report).toBeDefined()
  if (report === undefined) return

  // The number belongs in the build log, not only in a pass.
  console.log(
    `keystroke-to-paint: p95 ${report.p95Ms.toFixed(2)} ms, max ${report.maxMs.toFixed(2)} ms, over ${report.samples} samples`,
  )

  expect(
    report.p95Ms,
    `p95 keystroke-to-paint was ${report.p95Ms.toFixed(2)} ms over ${report.samples} samples, budget ${BUDGET_MS} ms`,
  ).toBeLessThanOrEqual(BUDGET_MS)
})
