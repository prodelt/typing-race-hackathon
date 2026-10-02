import { readFileSync } from 'node:fs'
import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test'
import { backendConfigured } from './harness/backend.js'
import { localAttemptIds, MOTION_OFF_SETTINGS, seedStore } from './harness/fixtures.js'
import { typeText } from './harness/type.js'

/**
 * ADR-0006 end to end: two browsers signed into one account. An attempt typed in A reaches the
 * cloud through the outbox and `submit-attempt`, and B unions it into its own local history on its
 * next sync (here, the boot sync of a fresh load).
 *
 * The account is a test user with an email identity, created over the Auth REST API because Google
 * cannot be driven from a test; its session is planted where the app keeps it. It is deliberately
 * not anonymous: a guest never syncs. Tagged `@backend` and skipped when the build has no Supabase
 * configuration. It creates a real user, so point it at a local stack, never at the live project;
 * the user is deleted at the end either way.
 */

const SESSION_KEY = 'typing-race:race-auth'
const SCALE = 'qwerty.run.anchors'

function env(name: string): string {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  const match = readFileSync('.env.local', 'utf8').match(new RegExp(`^${name}=(\\S+)`, 'm'))
  if (!match?.[1]) throw new Error(`${name} is not configured`)
  return match[1]
}

interface Session {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
  token_type: string
  user: { id: string }
}

async function accountTestUser(): Promise<Session> {
  const response = await fetch(`${env('VITE_SUPABASE_URL')}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: env('VITE_SUPABASE_ANON_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `e2e-${crypto.randomUUID()}@example.com`,
      password: crypto.randomUUID(),
      data: { is_test: true },
    }),
  })
  if (!response.ok) throw new Error(`test sign-up failed: ${response.status}`)
  return (await response.json()) as Session
}

/**
 * Removes the test user the way a learner does ("Delete my data"). The daily purge covers only
 * anonymous users, so an email user left behind would stay for good; a failed cleanup is loud.
 */
async function deleteTestUser(session: Session): Promise<void> {
  const response = await fetch(`${env('VITE_SUPABASE_URL')}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      apikey: env('VITE_SUPABASE_ANON_KEY'),
      Authorization: `Bearer ${session.access_token}`,
    },
  })
  if (!response.ok) console.warn(`test user ${session.user.id} was not deleted: ${response.status}`)
}

async function cloudAttemptIds(session: Session): Promise<string[]> {
  const response = await fetch(`${env('VITE_SUPABASE_URL')}/rest/v1/attempts?select=id`, {
    headers: {
      apikey: env('VITE_SUPABASE_ANON_KEY'),
      Authorization: `Bearer ${session.access_token}`,
    },
  })
  const rows = (await response.json()) as { id: string }[]
  return rows.map((row) => row.id)
}

/** A device signed into the shared account, with an English learner past the starting question. */
async function device(browser: Browser, session: Session): Promise<[BrowserContext, Page]> {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  await context.addInitScript(
    ({ key, value }) => {
      localStorage.setItem('typing-race:test-account', '1')
      localStorage.setItem(key, value)
    },
    { key: SESSION_KEY, value: JSON.stringify(session) },
  )
  const page = await context.newPage()
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS, typingLanguage: 'en', layoutId: 'qwerty' },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
  } as Parameters<typeof seedStore>[1])
  // The typing driver looks for this test id on the hidden textarea (see exercise.spec.ts).
  await page.addInitScript(() => {
    new MutationObserver(() => {
      for (const node of document.querySelectorAll('main textarea')) {
        if (node.getAttribute('data-testid') !== 'typing-input') {
          node.setAttribute('data-testid', 'typing-input')
        }
      }
    }).observe(document, { childList: true, subtree: true })
  })
  return [context, page]
}

test.describe('@backend sync', () => {
  test.skip(!backendConfigured(), 'Supabase is not configured for this build')

  test('an attempt typed on one device appears on the other after a sync', async ({ browser }) => {
    test.setTimeout(120_000)
    const session = await accountTestUser()
    try {
      const [contextA, a] = await device(browser, session)
      const [contextB, b] = await device(browser, session)

      // Device A trains once.
      await a.goto(`/exercise/${SCALE}?mode=practice`)
      await a.getByRole('button', { name: 'Почати', exact: true }).click()
      const text = await a.getByTestId('typing-line').locator('p.sr-only').textContent()
      // Human-paced, so the server's plausibility checks accept it.
      await typeText(a, text ?? '', 90)
      await expect(a).toHaveURL(/\/result\//)

      const [typed] = await localAttemptIds(a)
      expect(typed).toBeDefined()
      await expect.poll(() => cloudAttemptIds(session), { timeout: 30_000 }).toContain(typed)

      // Device B opens the app and syncs: the attempt is now part of its local history.
      await b.goto('/')
      await expect.poll(() => localAttemptIds(b), { timeout: 30_000 }).toContain(typed)

      await contextA.close()
      await contextB.close()
    } finally {
      await deleteTestUser(session)
    }
  })
})
