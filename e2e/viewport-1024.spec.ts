import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  expect,
  expectNoAxeViolations,
  MOTION_OFF_SETTINGS,
  seedStore,
  test,
} from './harness/fixtures.js'

/**
 * §6: the interface works from 1024 px wide. The rest of the suite runs at 1280x720, so nothing else
 * would notice a screen that overflows or hides its controls at the narrowest width a jury laptop
 * may use. Every main screen is opened at 1024x768; none may scroll sideways, and none may have an
 * accessibility violation. The screenshots are attached to the report for a look.
 */

test.use({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' })

const ROUTES: [string, string][] = [
  ['Home', '/'],
  ['Map', '/map'],
  ['Map, Stage 3', '/map?stage=3'],
  ['Profile', '/profile'],
  ['Settings', '/settings'],
  ['Review', '/review'],
  ['Races', '/races'],
  ['Community', '/community'],
  ['Formulas', '/formulas'],
  ['Licences', '/licences'],
  ['Privacy', '/privacy'],
  ['About', '/about'],
  ['An exercise, before the start', '/exercise/yq.run.anchors?mode=practice'],
  ['A session', '/session'],
]

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'knowsHomeRow', en: 'neverTouchTyped' },
  } as Parameters<typeof seedStore>[1])
})

for (const [name, route] of ROUTES) {
  test(`${name} fits 1024 px and has no accessibility violation`, async ({ page }, info) => {
    await page.goto(route)
    await expect(page.locator('#root')).not.toBeEmpty()
    await page.waitForTimeout(800)
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      wide: [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80)),
    }))
    const shot = await page.screenshot()
    await info.attach(`${name} at 1024`, { body: shot, contentType: 'image/png' })
    // `SHOTS_DIR=… pnpm test:e2e …` also writes them to disk, for a look by hand.
    if (process.env['SHOTS_DIR']) {
      writeFileSync(
        join(process.env['SHOTS_DIR'], `${route.replace(/[^a-z0-9]+/gi, '_')}.png`),
        shot,
      )
    }
    expect(
      overflow.page,
      `horizontal overflow, widest: ${overflow.wide.join(' | ')}`,
    ).toBeLessThanOrEqual(0)
    await expectNoAxeViolations(page)
  })
}
