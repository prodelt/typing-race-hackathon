/**
 * `pnpm data` — rebuilds `data/derived/` and `data/curriculum/` from the organisers' snapshot.
 *
 *   pnpm data                      # snapshot at tasks/Typing-Race-2026-Hackathon/dictionaries
 *   pnpm data -- <snapshot-dir>    # or DICTIONARIES_DIR=<snapshot-dir> pnpm data
 *   pnpm data -- --check           # rebuild in memory, fail if it differs from what is committed
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAcademy } from './academy'
import { runPipeline, writeOutput } from './pipeline'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const args = process.argv.slice(2)
const check = args.includes('--check')
const positional = args.find((a) => !a.startsWith('--'))
const snapshotDir = resolve(
  positional ??
    process.env['DICTIONARIES_DIR'] ??
    join(repoRoot, 'tasks/Typing-Race-2026-Hackathon/dictionaries'),
)

if (!existsSync(join(snapshotDir, 'CHECKSUMS.sha256'))) {
  console.error(`No dictionary snapshot at ${snapshotDir} (CHECKSUMS.sha256 missing).`)
  process.exit(2)
}

const derived = runPipeline(snapshotDir)
const outputs: { readonly dir: string; readonly files: Map<string, string> }[] = [
  { dir: 'data/derived', files: derived },
  { dir: 'data/curriculum', files: runAcademy(snapshotDir, derived) },
]

let failed = false
for (const { dir, files } of outputs) {
  const outDir = join(repoRoot, dir)
  if (check) {
    const stale = [...files].filter(([path, content]) => {
      const target = join(outDir, path)
      return !existsSync(target) || readFileSync(target, 'utf8') !== content
    })
    if (stale.length > 0) {
      console.error(`${dir} is out of date: ${stale.map(([p]) => p).join(', ')}. Run pnpm data.`)
      failed = true
    } else {
      process.stdout.write(`${dir} matches the snapshot (${files.size} files).\n`)
    }
  } else {
    writeOutput(outDir, files)
    for (const [path, content] of files) {
      process.stdout.write(`${dir}/${path}  ${Buffer.byteLength(content)} bytes\n`)
    }
  }
}
if (failed) process.exit(1)
