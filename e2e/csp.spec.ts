import type { Page } from '@playwright/test'
import { walkFirstRun } from './harness/firstRun.js'
import { expect, MOTION_OFF_SETTINGS, seedStore, test } from './harness/fixtures.js'
import { typeText } from './harness/type.js'

/**
 * The enforcing Content-Security-Policy, screen by screen.
 *
 * `vite preview` serves the headers `vercel.json` gives production (see `vite.config.ts`), so this
 * runs under the policy the deployed site enforces. A violation is collected from the page's own
 * `securitypolicyviolation` events — the one signal every engine raises the same way — and the
 * spec fails naming the directive and the blocked resource, which is what whoever widens or
 * narrows the policy needs to read.
 */

declare global {
  interface Window {
    __cspViolations?: string[]
  }
}

async function watchViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations?.push(
        `${event.effectiveDirective} blocked ${event.blockedURI || '(inline)'} on ${location.pathname}`,
      )
    })
  })
}

/** The exercise screen's textarea carries no test id; see the note in exercise.spec.ts. */
async function nameTypingInput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const name = () => {
      for (const node of document.querySelectorAll('main textarea')) {
        if (node.getAttribute('data-testid') !== 'typing-input') {
          node.setAttribute('data-testid', 'typing-input')
        }
      }
    }
    new MutationObserver(name).observe(document, { childList: true, subtree: true })
  })
}

async function violations(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__cspViolations ?? [])
}

/** Lets late work (lazy chunks, fonts, the worker, a Supabase handshake) land before reading. */
async function settle(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
}

test('the policy is enforced, not merely reported', async ({ page }) => {
  const response = await page.goto('/about')
  const headers = response?.headers() ?? {}
  expect(headers['content-security-policy']).toContain("script-src 'self'")
  expect(headers['content-security-policy-report-only']).toBeUndefined()
  expect(headers['strict-transport-security']).toMatch(/max-age=\d{7,}/)
})

test('no screen trips the Content-Security-Policy', async ({ page }) => {
  test.setTimeout(120_000)
  await watchViolations(page)
  await nameTypingInput(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
  } as never)

  const seen: string[] = []
  for (const route of [
    '/',
    '/map',
    '/review',
    '/profile',
    '/races',
    '/groups',
    '/leaderboards',
    '/settings',
    '/formulas',
    '/about',
    '/about/project',
    '/licences',
    '/privacy',
  ]) {
    await page.goto(route)
    await settle(page)
    seen.push(...(await violations(page)))
  }

  // An exercise typed to its end: the play screen, its keyboard and the result screen after it.
  await page.goto('/exercise/yq.run.anchors?mode=practice')
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  const text = (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? 'фіва'
  await typeText(page, text)
  await expect(page).toHaveURL(/\/result\//)
  await settle(page)
  seen.push(...(await violations(page)))

  expect(seen, `CSP violations:\n${seen.join('\n')}`).toEqual([])
})

test('the first run trips nothing either', async ({ page }) => {
  await watchViolations(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/today')
  await walkFirstRun(page)
  const seen = await violations(page)
  expect(seen, `CSP violations:\n${seen.join('\n')}`).toEqual([])
})
