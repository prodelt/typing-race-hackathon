import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Absolute, because each project below sets its own `root` and a relative setup path would be
// resolved against that package rather than against this file.
const here = (file: string) => fileURLToPath(new URL(file, import.meta.url))

const setupFiles = [here('./vitest.setup.ts')]
const domSetupFiles = [...setupFiles, here('./vitest.setup.dom.ts')]

/**
 * One Vitest project per workspace package, so a failure names the package it came from and so the
 * pure packages keep running in `node` — they must not acquire a jsdom habit, since the Supabase
 * Edge Functions import them unchanged.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'domain',
          root: './packages/domain',
          environment: 'node',
          setupFiles,
        },
      },
      {
        test: {
          name: 'metrics',
          root: './packages/metrics',
          environment: 'node',
          setupFiles,
        },
      },
      {
        test: {
          name: 'curriculum',
          root: './packages/curriculum',
          environment: 'node',
          setupFiles,
        },
      },
      {
        test: {
          name: 'engine',
          root: './packages/engine',
          environment: 'node',
          setupFiles,
        },
      },
      {
        test: {
          name: 'ui',
          root: './packages/ui',
          environment: 'jsdom',
          setupFiles: domSetupFiles,
        },
      },
      {
        test: {
          name: 'web',
          root: './apps/web',
          environment: 'jsdom',
          setupFiles: domSetupFiles,
        },
      },
      {
        // Architecture checks that read the source tree rather than import it. Rooted at the
        // repository, so they see every package at once.
        test: {
          name: 'arch',
          root: '.',
          environment: 'node',
          include: ['tools/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      // Only the logic packages are measured, and no threshold is enforced: a screen is proved by
      // its Playwright scenario, and logic is proved by tests that can fail for a real reason —
      // neither is proved by a line counter.
      include: [
        'packages/domain/src/**',
        'packages/metrics/src/**',
        'packages/curriculum/src/**',
        'packages/engine/src/**',
      ],
    },
  },
})
