import type { Page } from '@playwright/test'
import { expect, test as fixtureTest, MOTION_OFF_SETTINGS, seedStore } from './harness/fixtures.js'
import { typeText } from './harness/type.js'

/**
 * The Stage 1 moves a learner can now walk: the weakest Transition named on the result screen and
 * drilled from its one button, the tempo scale's stepped metronome, and the space bar as a scale of
 * its own.
 */

/** The harness drives `getByTestId('typing-input')`; see the note in exercise.spec.ts. */
const test = fixtureTest.extend({
  page: async ({ page }, use) => {
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
    await use(page)
  },
})

async function seed(page: Page, attempts: unknown[] = []): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedStore(page, {
    settings: { ...MOTION_OFF_SETTINGS },
    startingLevelByLanguage: { uk: 'neverTouchTyped', en: 'neverTouchTyped' },
    attempts,
  } as Parameters<typeof seedStore>[1])
}

/** A stored test attempt on the anchors that observed `ф → в` twelve times, missing eight. */
function weakAttempt() {
  const completedAt = Date.now() - 60_000
  return {
    id: 'weak',
    scaleId: 'yq.run.anchors',
    layoutId: 'yq',
    language: 'uk',
    mode: 'test',
    seed: 1,
    startedAt: completedAt - 15_000,
    completedAt,
    elapsedMs: 15_000,
    metrics: {
      spm: 180,
      wpm: 36,
      accuracy: 0.98,
      errorCount: 0,
      errorsByChar: {},
      rhythmConsistency: { value: 90, breaksExcluded: 0 },
      meanIkiByKey: {},
      meanIkiByTransition: {},
    },
    aggregates: {
      keys: {},
      transitions: { 'ф>в': { count: 12, misses: 8, sumIki: 5400, sumIkiSq: 2_430_000 } },
    },
  }
}

async function exerciseText(page: Page): Promise<string> {
  return (await page.getByTestId('typing-line').locator('p.sr-only').textContent()) ?? ''
}

async function begin(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Почати', exact: true }).click()
  await expect(page.getByTestId('typing-line')).toBeVisible()
}

test('the result names the weakest Transition and its one button opens a drill of that move', async ({
  page,
}) => {
  await seed(page, [weakAttempt()])
  await page.goto('/result/weak')

  const next = page.getByRole('region', { name: 'Що робити далі', exact: true })
  await expect(page.locator('[data-rule]')).toHaveAttribute('data-rule', 'weakTransition')
  await expect(next).toContainText('Перехід ф → в найслабший')
  await next.getByRole('button', { name: 'Почати' }).click()

  await expect(page).toHaveURL(/\/exercise\/yq\.transition\.KeyA-KeyD\?mode=practice/)
  await expect(page.getByRole('heading', { name: /Гама: перехід ф → в/ })).toBeVisible()
  await begin(page)
  const text = await exerciseText(page)
  expect(text.length).toBeGreaterThan(10)
  for (const item of text.split(' ')) expect(item).toContain('фв')
})

test('a tempo scale beats at a stepped target pace: 100, then 120, then 140 SPM', async ({
  page,
}) => {
  await seed(page)
  await page.goto('/exercise/yq.tempo.anchors?mode=practice')
  await begin(page)

  const cue = page.getByTestId('pace-cue')
  await expect(cue).toContainText('Темп 100 SPM · крок 1 з 3')

  const text = await exerciseText(page)
  const items = text.split(' ')
  expect(items).toHaveLength(9)
  // Three motifs and their spaces take the learner into the second step.
  await typeText(page, `${items.slice(0, 3).join(' ')} `)
  await expect(cue).toContainText('Темп 120 SPM · крок 2 з 3')
  await typeText(page, `${items.slice(3, 6).join(' ')} `)
  await expect(cue).toContainText('Темп 140 SPM · крок 3 з 3')
})

test('the space bar is a scale of its own: one letter of each hand either side of it', async ({
  page,
}) => {
  await seed(page)
  await page.goto('/exercise/yq.modifiers.space?mode=practice')
  await expect(page.getByRole('heading', { name: /Гама: клавіша Пробіл/ })).toBeVisible()
  await begin(page)
  expect(await exerciseText(page)).toMatch(/^[^ ]( [^ ])+$/u)
  await expect(page.getByTestId('pace-cue')).toHaveCount(0)
})
