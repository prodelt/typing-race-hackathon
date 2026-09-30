import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Absolute, because each project below sets its own `root` and a relative setup path would be
// resolved against that package rather than against this file.
const here = (file: string) => fileURLToPath(new URL(file, import.meta.url))

const setupFiles = [here('./vitest.setup.ts')]
const domSetupFiles = [...setupFiles, here('./vitest.setup.dom.ts')]

/**
 * One Vitest project per workspace package, so a failure names the package it came from and so the
 * pure packages keep running in `node` — they must not acquire a jsdom habit, since F2's Edge
 * Functions import them unchanged (ADR-0007).
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
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
      // Principle II asks for full coverage of the logic packages, and only of those: a screen is
      // proved by its Playwright scenario, not by a line counter.
      include: ['packages/metrics/src/**', 'packages/curriculum/src/**', 'packages/engine/src/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
})
