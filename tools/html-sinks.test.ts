import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * No place in the shipped source turns a string into markup or code. A nick, a group name, a race
 * text or a URL parameter is data the page did not write; the only way it can become script is
 * through one of these sinks, so none exists. React escapes everything it renders, and the CSP
 * (script-src 'self') is a second layer; this is the third, and the cheapest to keep.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'paraglide' || name === 'dist') return []
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const SINKS: [string, RegExp][] = [
  ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
  ['innerHTML', /\.innerHTML\b/],
  ['outerHTML', /\.outerHTML\b/],
  ['insertAdjacentHTML', /insertAdjacentHTML/],
  ['document.write', /document\.write(ln)?\s*\(/],
  ['eval', /(^|[^.\w])eval\s*\(/],
  ['new Function', /new\s+Function\s*\(/],
  ['string timers', /set(Timeout|Interval)\s*\(\s*['"`]/],
  ['javascript: URLs', /['"`]javascript:/i],
]

describe('the shipped source has no HTML or code sink', () => {
  const files = [
    ...sources(join(root, 'apps/web/src')),
    ...sources(join(root, 'packages/ui/src')),
    ...sources(join(root, 'packages/domain/src')),
    ...sources(join(root, 'packages/engine/src')),
    ...sources(join(root, 'packages/metrics/src')),
    ...sources(join(root, 'packages/curriculum/src')),
  ]

  it('looks at the source', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  for (const [name, pattern] of SINKS) {
    it(`never uses ${name}`, () => {
      const hits = files.filter((file) => pattern.test(readFileSync(file, 'utf8')))
      expect(hits.map((file) => file.slice(root.length))).toEqual([])
    })
  }
})
