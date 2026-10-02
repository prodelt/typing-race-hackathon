import { test } from '@playwright/test'
import { MOTION_OFF_SETTINGS, seedStore } from './harness/fixtures.js'

for (const size of [1000, 50_000, 200_000, 1_000_000]) {
  test(`probe ${size}`, async ({ page }) => {
    test.setTimeout(120_000)
    await seedStore(page, {
      settings: { ...MOTION_OFF_SETTINGS },
      startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
      attempts: [{ id: 'a', scaleId: 'x'.repeat(size) }],
    } as Parameters<typeof seedStore>[1])
    const start = Date.now()
    page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)))
    await page.goto('/', { waitUntil: 'commit' })
    for (let i = 0; i < 60; i++) {
      const filled = await page
        .evaluate(() => (document.getElementById('root')?.childElementCount ?? 0) > 0)
        .catch(() => false)
      if (filled) break
      await page.waitForTimeout(500)
    }
    console.log(`size ${size}: root filled after ${Date.now() - start} ms`)
    const text = await page.evaluate(() => document.body.innerText.slice(0, 120)).catch(() => 'n/a')
    console.log('body:', JSON.stringify(text))
  })
}
