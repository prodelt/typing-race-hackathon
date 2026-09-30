import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, transformWithOxc } from 'vite'

const appRoot = fileURLToPath(new URL('./apps/web', import.meta.url))

/** Ticket 15: initial JS at most 150 KB gzip, with Motion and the charts lazy-loaded. */
const INITIAL_JS_BUDGET_BYTES = 150 * 1024

/**
 * Fails the build when the *initial* JavaScript graph outgrows the budget.
 *
 * "Initial" is the entry chunk plus everything it reaches through static imports — a lazily
 * imported chunk is deliberately not counted, which is what makes the budget a design constraint
 * rather than a total-size warning. Gzip, because that is what the browser downloads and what
 * ticket 15 measured.
 */
function initialJsBudget(limitBytes: number): Plugin {
  return {
    name: 'typing-race:initial-js-budget',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((output) => output.type === 'chunk')
      const entry = chunks.find((chunk) => chunk.isEntry)
      if (!entry) return

      const byFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
      const reached = new Set<string>()
      const queue = [entry.fileName]
      while (queue.length > 0) {
        const fileName = queue.pop()
        if (fileName === undefined || reached.has(fileName)) continue
        reached.add(fileName)
        queue.push(...(byFileName.get(fileName)?.imports ?? []))
      }

      const code = [...reached].map((fileName) => byFileName.get(fileName)?.code ?? '').join('')
      const bytes = gzipSync(Buffer.from(code, 'utf-8')).byteLength
      const report = `${(bytes / 1024).toFixed(1)} KB gzip over ${reached.size} chunk(s)`

      if (bytes > limitBytes) {
        this.error(
          `Initial JS budget exceeded: ${report}, limit ${(limitBytes / 1024).toFixed(0)} KB. ` +
            'Lazy-load the offending module (ticket 15) rather than raising the limit.',
        )
      }
      this.info(`initial JS ${report}`)
    },
  }
}

/**
 * T066, FR-074. Emits `/sw.js` with the precache manifest written into it.
 *
 * The worker source (`src/sw/worker.ts`) has no imports, so it is compiled on its own and never
 * joins the app's chunk graph, which keeps it out of the initial-JS budget. `enforce: 'post'`
 * puts this after Vite's HTML plugin, so `index.html` is already in the bundle when we read it.
 * Source maps are not precached; everything else the build emitted is, which covers the hashed JS
 * and CSS, the bundled woff2 fonts and the HTML shell.
 */
function serviceWorker(): Plugin {
  const source = fileURLToPath(new URL('./apps/web/src/sw/worker.ts', import.meta.url))
  return {
    name: 'typing-race:service-worker',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_options, bundle) {
      const files = Object.values(bundle)
        .filter((output) => !output.fileName.endsWith('.map'))
        .sort((a, b) => a.fileName.localeCompare(b.fileName))
      const hash = createHash('sha256')
      for (const output of files) {
        hash.update(output.fileName)
        if (output.type === 'asset' && output.fileName.endsWith('.html')) {
          hash.update(String(output.source))
        }
      }
      const manifest = {
        version: hash.digest('hex').slice(0, 16),
        urls: ['/', ...files.map((output) => `/${output.fileName}`)],
      }
      const compiled = await transformWithOxc(readFileSync(source, 'utf-8'), source, { lang: 'ts' })
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: compiled.code.replaceAll('__PRECACHE_MANIFEST__', JSON.stringify(manifest)),
      })
    },
  }
}

export default defineConfig({
  root: appRoot,
  // Environment files stay at the repository root, next to .env.example.
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [
    react(),
    tailwindcss(),
    paraglideVitePlugin({
      project: `${appRoot}/project.inlang`,
      outdir: `${appRoot}/src/paraglide`,
      strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
    }),
    initialJsBudget(INITIAL_JS_BUDGET_BYTES),
    serviceWorker(),
  ],
  build: {
    target: 'es2023',
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
})
