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
      typingLanguage: 'en',
      layoutId: 'qwerty',
      interfaceLanguage: 'uk',
    },
    // A learner who has answered the first run, or every route opens the first run instead.
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
  } as never)
  // The exercise screen's textarea carries no test id; see the note in exercise.spec.ts.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      for (const node of document.querySelectorAll('main textarea')) {
        if (node.getAttribute('data-testid') !== 'typing-input') {
          node.setAttribute('data-testid', 'typing-input')
        }
      }
    }).observe(document, { childList: true, subtree: true })
  })

  // The Play screen of a Practice Attempt: the typing line *and* the keyboard guide, the heaviest
  // thing that repaints per keystroke.
  await page.goto('/exercise/qwerty.run.anchors?mode=practice')

  const probePresent = await page.evaluate(() => window.__typingRaceLatency !== undefined)
  test.skip(
    !probePresent,
    'The latency probe is compiled out of this build. Run against the dev server, or build with VITE_LATENCY_PROBE=true.',
  )

  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('keyboard-guide')).toBeVisible()
  await expect(typingSurface(page)).toBeAttached()

  // The instrument's own floor on this machine: the same rAF-then-macrotask wait from a random
  // moment with no keystroke at all. Where the flags above take effect it is near zero; where the
  // compositor still runs at 60 Hz (headless Chromium on some Windows hosts) it is most of a frame,
  // and a p95 near 16 ms says more about the display than about the typing path. Logged, not
  // gated, so a failing number can be read against it.
  const floor = await page.evaluate(async () => {
    const waits: number[] = []
    for (let i = 0; i < 200; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 30))
      const t0 = performance.now()
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
      waits.push(performance.now() - t0)
    }
    waits.sort((x, y) => x - y)
    return waits[189] ?? 0
  })
  console.log(`instrument floor with no keystroke: p95 ${floor.toFixed(2)} ms`)

  await page.evaluate(() => {
    window.__typingRaceLatency?.startLatencyProbe()
  })

  // Free correction, so a wrong character never stops the run: this spec measures paint latency,
  // not judging. The characters themselves are irrelevant — only that each is one real keystroke.
  for (let i = 0; i < KEYSTROKES; i += 1) {
    await typeChar(page, 'f')
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
