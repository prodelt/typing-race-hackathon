/**
 * Bundles the workspace packages the Edge Functions import into `supabase/functions/_shared/vendor/`.
 *
 * `supabase functions deploy --use-api` uploads only what sits under `supabase/functions/`, so an
 * import map pointing at `../../packages/*` is rejected. Bundling rather than copying also removes
 * the need for Deno's `sloppy-imports`: the packages' extensionless internal imports are resolved
 * here, by the same bundler the browser build uses, and the functions receive plain ES modules.
 *
 * The output is generated and gitignored; `pnpm supabase:functions` runs this before every deploy.
 */
import { rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = fileURLToPath(new URL('../supabase/functions/_shared/vendor', import.meta.url))

rmSync(outDir, { recursive: true, force: true })

await build({
  configFile: false,
  root,
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    target: 'es2022',
    lib: {
      entry: {
        metrics: `${root}packages/metrics/src/index.ts`,
        curriculum: `${root}packages/curriculum/src/index.ts`,
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
  },
})

// `@typing-race/domain` is types only; the functions import it with `import type`, which Deno
// erases, but the import map still needs somewhere to point.
writeFileSync(`${outDir}/domain.js`, 'export {}\n')
