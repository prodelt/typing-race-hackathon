/**
 * `pnpm data` — rebuilds `data/derived/` from the organisers' dictionary snapshot.
 *
 *   pnpm data                      # snapshot at tasks/Typing-Race-2026-Hackathon/dictionaries
 *   pnpm data -- <snapshot-dir>    # or DICTIONARIES_DIR=<snapshot-dir> pnpm data
 *   pnpm data -- --check           # rebuild in memory, fail if it differs from what is committed
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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
const outDir = join(repoRoot, 'data/derived')

if (!existsSync(join(snapshotDir, 'CHECKSUMS.sha256'))) {
  console.error(`No dictionary snapshot at ${snapshotDir} (CHECKSUMS.sha256 missing).`)
  process.exit(2)
}

const files = runPipeline(snapshotDir)

if (check) {
  const stale = [...files].filter(([path, content]) => {
    const target = join(outDir, path)
    return !existsSync(target) || readFileSync(target, 'utf8') !== content
  })
  if (stale.length > 0) {
    console.error(
      `data/derived is out of date: ${stale.map(([p]) => p).join(', ')}. Run pnpm data.`,
    )
    process.exit(1)
  }
  process.stdout.write(`data/derived matches the snapshot (${files.size} files).\n`)
} else {
  writeOutput(outDir, files)
  for (const [path, content] of files) {
    process.stdout.write(`data/derived/${path}  ${Buffer.byteLength(content)} bytes\n`)
  }
}
