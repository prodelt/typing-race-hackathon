import { expect, type Page, test } from '@playwright/test'
import { backendConfigured } from './harness/backend.js'
import { addUser, fakeSupabase, SESSION_KEY, seedLearner } from './harness/fakeSupabase.js'
import { MOTION_OFF_SETTINGS, seedRawEnvelope, seedStore } from './harness/fixtures.js'

/**
 * The browser side attacked: the headers every route carries, hostile URLs, hostile data in the
 * stores the page reads, and the ways text can reach the typing surface other than a key.
 *
 * Threat model: someone who can send a learner a link, put a hostile nick or group name on a board,
 * or (as a worst case) write to the page's own storage. The product's defences are layered on
 * purpose, and each layer is checked alone here: React never renders data as HTML (and no HTML
 * sink exists in the source: `tools/html-sinks.test.ts`), the CSP forbids inline script, and the
 * input seam ignores everything that is not a keystroke.
 */

const PAYLOAD = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'

/** Fails the test if any payload ran, and records the page's own uncaught errors. */
async function watchForScript(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('dialog', (dialog) => {
    errors.push(`dialog: ${dialog.message()}`)
    void dialog.dismiss()
  })
  return errors
}

async function nothingRan(page: Page): Promise<void> {
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  expect(await page.locator('img[src="x"]').count()).toBe(0)
}

// ---- Headers -----------------------------------------------------------------------------------

test.describe('security headers', () => {
  const ROUTES = [
    '/',
    '/map',
    '/races',
    '/profile',
    '/settings',
    '/privacy',
    '/licences',
    '/exercise/yq.run.anchors',
    '/result/00000000-0000-4000-8000-000000000000',
    '/no/such/route',
    '/sw.js',
    '/favicon.svg',
    '/robots.txt',
  ]

  for (const route of ROUTES) {
    test(`${route} carries the full set`, async ({ request }) => {
      const response = await request.get(route)
      const headers = response.headers()

      const policy = headers['content-security-policy'] ?? ''
      const directive = (name: string): string[] =>
        (policy.split(';').find((part) => part.trim().startsWith(`${name} `)) ?? '')
          .trim()
          .split(/\s+/)
          .slice(1)
      expect(policy, 'a CSP header').not.toBe('')
      expect(directive('default-src')).toEqual(["'self'"])
      // No inline script, no eval, no remote script, no data: or blob: script.
      expect(directive('script-src')).toEqual(["'self'"])
      expect(directive('style-src')).toEqual(["'self'"])
      expect(directive('object-src')).toEqual(["'none'"])
      expect(directive('frame-src')).toEqual(["'none'"])
      expect(directive('frame-ancestors')).toEqual(["'none'"])
      expect(directive('base-uri')).toEqual(["'self'"])
      expect(directive('form-action')).toEqual(["'self'"])
      // The backend is named, not wildcarded: no bare scheme, no `*`.
      for (const source of directive('connect-src')) {
        expect(source, 'connect-src source').not.toMatch(/^(\*|https?:|wss?:|data:|blob:)$/)
      }

      expect(headers['strict-transport-security']).toMatch(/max-age=(\d{8,})/)
      expect(headers['strict-transport-security']).toContain('includeSubDomains')
      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['x-frame-options']).toBe('DENY')
      expect(headers['referrer-policy']).toBeTruthy()
      expect(headers['permissions-policy']).toContain('camera=()')
      expect(headers['permissions-policy']).toContain('microphone=()')
      expect(headers['permissions-policy']).toContain('geolocation=()')
    })
  }
})

// ---- Hostile URLs ------------------------------------------------------------------------------

test.describe('hostile addresses', () => {
  const encoded = encodeURIComponent(PAYLOAD)
  const ADDRESSES = [
    `/races/join/${encoded}`,
    `/exercise/${encoded}`,
    `/result/${encoded}`,
    `/academy/${encoded}`,
    `/map?stage=${encoded}&course=${encoded}`,
    `/?go=${encoded}&lang=${encoded}`,
    `/?error=${encoded}&error_code=${encoded}&error_description=${encoded}`,
    `/#error_description=${encoded}&error_code=${encoded}`,
    `/groups/${encoded}`,
  ]

  for (const address of ADDRESSES) {
    test(`nothing in ${address.slice(0, 40)}… runs or renders as markup`, async ({ page }) => {
      const errors = await watchForScript(page)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await seedStore(page, {
        settings: { ...MOTION_OFF_SETTINGS },
        startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
      } as Parameters<typeof seedStore>[1])
      await page.goto(address)
      await expect(page.locator('#root')).not.toBeEmpty()
      await page.waitForTimeout(500)
      await nothingRan(page)
      expect(errors.filter((message) => message.startsWith('dialog'))).toEqual([])
    })
  }

  test.describe('the return from Google', () => {
    const HOSTILE_RETURNS = [
      'https://evil.example/phish',
      '//evil.example/phish',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:window.__xss=1',
      'data:text/html,<script>window.__xss=1</script>',
      '',
    ]
    for (const value of HOSTILE_RETURNS) {
      test(`a remembered address of ${JSON.stringify(value)} never leaves this origin`, async ({
        page,
        baseURL,
      }) => {
        await page.addInitScript(({ key, stored }) => sessionStorage.setItem(key, stored), {
          key: 'typing-race:auth-return-to',
          stored: value,
        })
        await page.goto('/?code=abc&state=def')
        await expect(page.locator('#root')).not.toBeEmpty()
        const here = new URL(page.url())
        expect(here.origin).toBe(new URL(baseURL ?? 'http://127.0.0.1:4173').origin)
        // The code is gone from the address, and so is the hostile value as a destination.
        expect(here.search).not.toContain('code=')
        expect(here.pathname.startsWith('/')).toBe(true)
        expect(here.pathname.startsWith('//')).toBe(false)
        await nothingRan(page)
      })
    }

    test('a legitimate remembered path is restored', async ({ page }) => {
      await page.addInitScript(() =>
        sessionStorage.setItem('typing-race:auth-return-to', '/map?stage=2'),
      )
      await page.goto('/?code=abc')
      await expect(page).toHaveURL(/\/map\?stage=2$/)
    })
  })
})

// ---- Tampered storage --------------------------------------------------------------------------

test.describe('a page whose storage was written by someone else', () => {
  /** The keys `Object.prototype` has before anything runs, to see whether the app adds one. */
  async function protoGuard(page: Page): Promise<void> {
    await page.addInitScript(() => {
      ;(window as unknown as { __protoKeys: string[] }).__protoKeys = Object.getOwnPropertyNames(
        Object.prototype,
      )
    })
  }

  async function intact(page: Page): Promise<void> {
    const verdict = await page.evaluate(() => ({
      polluted: ({} as Record<string, unknown>)['polluted'],
      keys: Object.getOwnPropertyNames(Object.prototype),
      before: (window as unknown as { __protoKeys: string[] }).__protoKeys,
    }))
    expect(verdict.polluted).toBeUndefined()
    expect(verdict.keys).toEqual(verdict.before)
  }

  const ENVELOPES: [string, Record<string, unknown>][] = [
    [
      'attempts of the wrong types',
      { attempts: [{ id: 1, scaleId: {}, metrics: null, mode: 7 }, null, 'x', []] },
    ],
    [
      'settings out of range',
      {
        settings: {
          ...MOTION_OFF_SETTINGS,
          theme: '<script>window.__xss=1</script>',
          textSizePx: 1e9,
          motion: {},
          typingLanguage: 'xx',
          layoutId: '__proto__',
          interfaceLanguage: 'constructor',
        },
      },
    ],
    ['a megabyte of exercise id', { attempts: [{ id: 'a', scaleId: 'x'.repeat(1_000_000) }] }],
    ['progress that is not an object', { progressByLanguage: 'x', logs: 7, attempts: 'many' }],
  ]

  for (const [label, envelope] of ENVELOPES) {
    test(`IndexedDB with ${label}: the app still starts and nothing is polluted`, async ({
      page,
    }) => {
      const errors = await watchForScript(page)
      await protoGuard(page)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await seedStore(page, {
        settings: { ...MOTION_OFF_SETTINGS },
        startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
        ...envelope,
      } as Parameters<typeof seedStore>[1])
      await page.goto('/')
      await expect(page.locator('#root')).not.toBeEmpty()
      await page.waitForTimeout(500)
      await nothingRan(page)
      await intact(page)
      // It works, or it says the store cannot be read; it is never a blank page or the router's
      // default "Something went wrong" screen.
      await expect(page.locator('#root')).not.toBeEmpty()
      await expect(page.getByText('Something went wrong')).toHaveCount(0)
      expect(errors.filter((message) => message.startsWith('dialog'))).toEqual([])
    })
  }

  test('a prototype key in the stored JSON does not reach Object.prototype', async ({ page }) => {
    await protoGuard(page)
    await seedRawEnvelope(
      page,
      '{"storeVersion":1,"writtenAt":1,"progressByLanguage":{"__proto__":{"polluted":"yes"}},' +
        '"attempts":[{"id":"a","__proto__":{"polluted":"yes"},"aggregates":{"keys":{"__proto__":{"polluted":"yes"}}}}],' +
        '"logs":{"__proto__":{"polluted":"yes"}},"settings":{"__proto__":{"polluted":"yes"}},' +
        '"startingLevelByLanguage":{"uk":"neverTouchTyped","en":"neverTouchTyped"},' +
        '"constructor":{"prototype":{"polluted":"yes"}}}',
    )
    await page.goto('/')
    await expect(page.locator('#root')).not.toBeEmpty()
    await page.waitForTimeout(500)
    await intact(page)
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
  })

  test('localStorage with a hostile nick, a broken session and a huge name: still starts, nothing runs', async ({
    page,
  }) => {
    const errors = await watchForScript(page)
    await protoGuard(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedStore(page, {
      settings: { ...MOTION_OFF_SETTINGS },
      startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    } as Parameters<typeof seedStore>[1])
    await page.addInitScript(
      ({ payload, session }) => {
        localStorage.setItem(session, 'not json {{{')
        localStorage.setItem(
          'typing-race:account',
          JSON.stringify({ kind: 'google', nick: payload, __proto__: { polluted: 'yes' } }),
        )
        localStorage.setItem('typing-race:race-name', payload.repeat(20_000))
      },
      { payload: PAYLOAD, session: SESSION_KEY },
    )
    await page.goto('/profile')
    await expect(page.locator('#root')).not.toBeEmpty()
    await page.waitForTimeout(500)
    // The cached nick is shown as text, never as markup.
    await nothingRan(page)
    await intact(page)
    expect(errors.filter((message) => message.startsWith('dialog'))).toEqual([])
  })
})

// ---- Text that is not a keystroke --------------------------------------------------------------

test.describe('paste, drop and edit commands on the typing surface', () => {
  test('none of them types, and none of them completes an exercise', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedStore(page, {
      settings: { ...MOTION_OFF_SETTINGS },
      startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    } as Parameters<typeof seedStore>[1])
    await page.goto('/exercise/yq.run.anchors?mode=practice')
    await page.getByRole('button', { name: 'Почати', exact: true }).click()
    const line = page.getByTestId('typing-line')
    await expect(line).toBeVisible()
    const text = (await line.locator('p.sr-only').textContent()) ?? ''
    expect(text.length).toBeGreaterThan(10)

    const awaited = () =>
      line
        .locator('.typing-line__char')
        .evaluateAll((nodes) =>
          nodes.findIndex((node) => node.getAttribute('data-state') === 'awaited'),
        )
    expect(await awaited()).toBe(0)

    await page
      .locator('textarea')
      .first()
      .evaluate((area, whole) => {
        const send = (inputType: string) =>
          area.dispatchEvent(
            new InputEvent('beforeinput', {
              inputType,
              data: whole,
              bubbles: true,
              cancelable: true,
            }),
          )
        for (const type of [
          // The whole line in one ordinary text insertion: one key never makes a line.
          'insertText',
          'insertFromPaste',
          'insertFromDrop',
          'insertReplacementText',
          'insertFromYank',
          'historyUndo',
          'historyRedo',
          'formatBold',
          'deleteByCut',
        ]) {
          send(type)
        }
        const data = new DataTransfer()
        data.setData('text/plain', whole)
        area.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
        )
        area.dispatchEvent(
          new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
        )
      }, text)

    expect(await awaited()).toBe(0)
    await expect(page).not.toHaveURL(/\/result\//)
  })

  // COMPETITION_RULES §4.4.4: "a series of instant identical events". Each one is a keystroke the
  // seam accepts, so the exercise completes; what must not happen is that it counts.
  for (const [label, send] of [
    ['one character per event, all at once', 'series'],
    ['the whole line committed as one composition', 'composition'],
  ] as const) {
    test(`a test typed as ${label} completes but counts for nothing`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await seedStore(page, {
        settings: { ...MOTION_OFF_SETTINGS },
        startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
      } as Parameters<typeof seedStore>[1])
      await page.goto('/exercise/yq.run.anchors?mode=test')
      await page.getByRole('button', { name: 'Почати', exact: true }).click()
      const line = page.getByTestId('typing-line')
      await expect(line).toBeVisible()
      const text = (await line.locator('p.sr-only').textContent()) ?? ''

      await page
        .locator('textarea')
        .first()
        .evaluate(
          (area, { whole, how }) => {
            if (how === 'composition') {
              area.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
              area.dispatchEvent(
                new CompositionEvent('compositionend', { data: whole, bubbles: true }),
              )
              return
            }
            for (const char of whole) {
              area.dispatchEvent(
                new InputEvent('beforeinput', {
                  inputType: 'insertText',
                  data: char,
                  bubbles: true,
                  cancelable: true,
                }),
              )
            }
          },
          { whole: text, how: send },
        )

      await expect(page).toHaveURL(/\/result\//)
      const score = page.getByTestId('result-score')
      await expect(score.getByRole('heading', { level: 1 })).toHaveText(
        'Не зараховано: набір не схожий на ручний',
      )
      await expect(page.getByTestId('result-note')).toHaveText(
        'Спробу збережено, але вона не йде ні в опанування, ні в досвід, ні в рекорди.',
      )
      // 100% accurate, and still no XP and no slot in the mastery streak.
      await expect(score).toContainText(/100[.,]0\s*%/)
      await expect(score.locator('.reward-xp')).toHaveCount(0)
      await expect(page.locator('.reward-slot.is-ok')).toHaveCount(0)
    })
  }
})

// ---- Hostile data from the server --------------------------------------------------------------

test.describe('@backend a hostile nick from the server', () => {
  test.skip(!backendConfigured(), 'Supabase is not configured for this build')

  test('is shown as text in the status bar and the account, and nothing runs', async ({ page }) => {
    const errors = await watchForScript(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const fake = await fakeSupabase(page)
    const user = addUser(fake, {
      id: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      email: 'olesia.k@example.com',
      anonymous: false,
      nickname: PAYLOAD,
    })
    await seedLearner(page, { session: fake.session(user) })
    await page.goto('/profile')
    await expect(page.getByTestId('account-nick')).toContainText('<img src=x', { timeout: 15_000 })
    await nothingRan(page)
    expect(errors.filter((message) => message.startsWith('dialog'))).toEqual([])
  })
})
