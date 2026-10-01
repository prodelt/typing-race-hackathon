import { globSync, readFileSync } from 'node:fs'
import { sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The seam boundary, enforced (T011, plan.md "Agreed Test Seams").
 *
 * > No code outside `apps/web/src/seams/` touches IndexedDB, the Cache API, `performance.now()`,
 * > `Math.random()` or a DOM input event.
 *
 * Principle III is only true on day one unless something checks it, and this is the something.
 * Biome's `noRestrictedGlobals` covers the two bare globals; the other three are member calls and
 * string-literal event names, which a lint rule would need a custom plugin to see. A scan is
 * cheaper, reads better when it fails, and runs inside `pnpm test`, which is a gate we keep.
 */

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

const SCANNED = ['packages/*/src/**/*.{ts,tsx}', 'apps/web/src/**/*.{ts,tsx}']

/**
 * Three exemptions, each because the directory *is* the outside world rather than a consumer of it.
 * Every one of them is named in plan.md's ownership table as Foundational.
 */
const EXEMPT = [
  // The seams themselves. This is the whole point.
  'apps/web/src/seams/',
  // The service worker: AssetCache's real adapter is a service worker, and a service worker that
  // may not call `caches` is not one.
  'apps/web/src/sw/',
  // The latency probe measures real elapsed time as an upper bound on keystroke-to-paint
  // (research R8). Reading it through a seam the test could stub would measure the stub.
  'apps/web/src/instrument/',
  // Paraglide compiler output.
  'apps/web/src/paraglide/',
  // The command palette's Ctrl+K accelerator. The rule exists so that the *attempt's* input path
  // has exactly one reader; a window-level shortcut reads no character, feeds no engine and runs
  // only while no attempt is in progress. Routing it through InputSource would mean giving the
  // typing seam a second job, which is the opposite of what Constitution III asks for.
  'apps/web/src/app/CommandPalette.tsx',
  // The shell's 1–5 destination keys: the same kind of accelerator, and switched off in Play
  // Mode and whenever focus is in a field or the typing surface, so it never meets an attempt.
  'apps/web/src/app/Shell.tsx',
]

interface Rule {
  readonly what: string
  readonly pattern: RegExp
  readonly seam: string
}

const RULES: Rule[] = [
  {
    what: 'IndexedDB',
    pattern: /\bindexedDB\b/,
    seam: 'ProgressStore — apps/web/src/seams/store.ts',
  },
  {
    what: 'the Cache API',
    pattern: /\bcaches\s*[.[]/,
    seam: 'AssetCache — apps/web/src/seams/cache.ts',
  },
  {
    what: 'performance.now()',
    pattern: /\bperformance\s*\.\s*now\s*\(/,
    seam: 'Clock — apps/web/src/seams/clock.ts',
  },
  {
    what: 'Math.random()',
    pattern: /\bMath\s*\.\s*random\s*\(/,
    seam: 'Random — apps/web/src/seams/random.ts',
  },
  {
    what: 'a DOM input event listener',
    pattern:
      /addEventListener\s*\(\s*['"`](?:beforeinput|input|compositionstart|compositionupdate|compositionend|keydown|keypress|keyup)['"`]/,
    seam: 'InputSource — apps/web/src/seams/input.ts',
  },
]

/** Comments explain the rule; they must not trip it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function scannedFiles(): string[] {
  return SCANNED.flatMap((pattern) => globSync(pattern, { cwd: repoRoot }))
    .map((file) => file.split(sep).join('/'))
    .filter((file) => !EXEMPT.some((prefix) => file.startsWith(prefix)))
    .sort()
}

describe('the seam boundary (Constitution III, plan.md "Agreed Test Seams")', () => {
  for (const rule of RULES) {
    it(`keeps ${rule.what} behind its seam`, () => {
      const offenders = scannedFiles().filter((file) =>
        rule.pattern.test(stripComments(readFileSync(`${repoRoot}${file}`, 'utf-8'))),
      )

      expect(
        offenders,
        `${rule.what} may only be used inside a seam. Go through ${rule.seam} instead, ` +
          'or add the file to EXEMPT here with the reason written out.',
      ).toEqual([])
    })
  }

  it('actually scans something, so a broken glob cannot pass silently', () => {
    expect(scannedFiles().length).toBeGreaterThan(0)
  })
})
