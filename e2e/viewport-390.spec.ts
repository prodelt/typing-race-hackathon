import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  expect,
  expectFocusablesNamed,
  expectNoAxeViolations,
  MOTION_OFF_SETTINGS,
  seedStore,
  test,
} from './harness/fixtures.js'

/**
 * D3: the interface holds at 390x844, a phone. Training needs a physical keyboard, so the phone
 * shows the reading screens and a calm notice on the rest, but nothing may scroll sideways or be
 * cut at the edge, the bottom dock spans the whole width, and every focus stop keeps a role and
 * a name. Screenshots are attached to the report for a look.
 */

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
})

const WIDTH = 390

const ROUTES: [string, string][] = [
  ['Home', '/'],
  ['Map', '/map'],
  ['Races', '/races'],
  ['Groups', '/groups'],
  ['Profile', '/profile'],
  ['Settings', '/settings'],
  ['Licences', '/licences'],
  ['Privacy', '/privacy'],
  ['Formulas', '/formulas'],
  ['About', '/about'],
  ['About the project', '/about/project'],
  ['Own text', '/own'],
  ['Sprint', '/sprint'],
  ['Daily', '/daily'],
]

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox has no mobile viewport emulation')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'knowsHomeRow', en: 'neverTouchTyped' },
  } as Parameters<typeof seedStore>[1])
})

for (const [name, route] of ROUTES) {
  test(`${name} fits 390 px with nothing cut`, async ({ page }, info) => {
    await page.goto(route)
    await expect(page.locator('#root')).not.toBeEmpty()
    await page.waitForTimeout(800)

    const layout = await page.evaluate((width) => {
      // Content that scrolls sideways on purpose: a table in its own scroll area, a typing line.
      const scrollsOnPurpose = (el: Element): boolean => {
        for (let at: Element | null = el.parentElement; at !== null; at = at.parentElement) {
          if (at.matches('.typing-line, [role="tooltip"]')) return true
          const overflowX = getComputedStyle(at).overflowX
          if (overflowX === 'auto' || overflowX === 'scroll') {
            if (!at.matches('.stage__scroll, html, body')) return true
          }
        }
        return false
      }
      const cut = [
        ...document.querySelectorAll<HTMLElement>(
          'h1, h2, h3, p, a, button, label, input, li, [role="group"]',
        ),
      ]
        .filter((el) => {
          const box = el.getBoundingClientRect()
          if (box.width === 0 || box.height === 0) return false
          if (getComputedStyle(el).visibility === 'hidden') return false
          if (box.right <= width + 1 && box.left >= -1) return false
          return !scrollsOnPurpose(el)
        })
        .slice(0, 5)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${Math.round(el.getBoundingClientRect().left)}–${Math.round(el.getBoundingClientRect().right)}`,
        )
      const stage = document.querySelector('.stage__scroll')
      return {
        page: document.documentElement.scrollWidth,
        stage: stage === null ? 0 : stage.scrollWidth - stage.clientWidth,
        cut,
      }
    }, WIDTH)

    const shot = await page.screenshot({ fullPage: true })
    await info.attach(`${name} at 390`, { body: shot, contentType: 'image/png' })
    if (process.env['SHOTS_DIR']) {
      writeFileSync(
        join(process.env['SHOTS_DIR'], `390${route.replace(/[^a-z0-9]+/gi, '_')}.png`),
        shot,
      )
    }

    expect(layout.page, 'the page scrolls sideways').toBeLessThanOrEqual(WIDTH)
    expect(layout.stage, 'the stage scrolls sideways').toBeLessThanOrEqual(0)
    expect(layout.cut, 'elements cut at the screen edge').toEqual([])
    await expectFocusablesNamed(page)
    await expectNoAxeViolations(page)
  })
}

test('the bottom dock spans the whole width with five even tabs', async ({ page }) => {
  await page.goto('/profile')
  const dock = page.getByRole('navigation', { name: 'Основна навігація' })
  await expect(dock).toBeVisible()
  const boxes = await dock.locator('.rail__item').evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect()
      return { left: box.left, right: box.right, width: box.width }
    }),
  )
  expect(boxes).toHaveLength(5)
  expect(boxes[0]?.left ?? -1).toBeLessThanOrEqual(1)
  expect(boxes.at(-1)?.right ?? 0).toBeGreaterThanOrEqual(WIDTH - 1)
  const widths = boxes.map((box) => box.width)
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
  // Neighbours never touch: every label sits inside its own tab.
  const labels = await dock.locator('.rail__label').evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect()
      return { left: box.left, right: box.right }
    }),
  )
  for (let i = 1; i < labels.length; i++) {
    expect((labels[i]?.left ?? 0) - (labels[i - 1]?.right ?? 0)).toBeGreaterThanOrEqual(4)
  }
})
