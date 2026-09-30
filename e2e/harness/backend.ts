import { existsSync, readFileSync } from 'node:fs'
import type { Browser, Page } from '@playwright/test'

/**
 * Helpers for the `@backend` specs, which run against the real Supabase project.
 *
 * Every learner such a spec creates is a **test account**: the flag below makes the app sign up
 * with `is_test: true`, the database copies it onto the profile, and no board a real learner sees
 * ever shows the row. A run of the suite therefore leaves the jury's leaderboard untouched.
 */

export function backendConfigured(): boolean {
  if (process.env['VITE_SUPABASE_URL'] && process.env['VITE_SUPABASE_ANON_KEY']) return true
  if (!existsSync('.env.local')) return false
  const env = readFileSync('.env.local', 'utf8')
  return /^VITE_SUPABASE_URL=\S+/m.test(env) && /^VITE_SUPABASE_ANON_KEY=\S+/m.test(env)
}

/** A fresh, isolated learner. Marked as a test account unless `real` is asked for. */
export async function learner(browser: Browser, options: { real?: boolean } = {}): Promise<Page> {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  if (options.real !== true) {
    await context.addInitScript(() => {
      localStorage.setItem('typing-race:test-account', '1')
    })
  }
  return context.newPage()
}
