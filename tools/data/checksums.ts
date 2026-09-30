import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `CHECKSUMS.sha256` in `sha256sum` format, paths relative to the snapshot's parent directory
 * (`dictionaries/english/...`). Keys are returned relative to the snapshot directory itself and
 * NFC-normalised: ten entries were written on macOS in NFD, and the files on disk are NFC.
 */
export function parseChecksums(text: string): Map<string, string> {
  const entries = new Map<string, string>()
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line.trim() === '') continue
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line)
    if (match === null) throw new Error(`Unreadable checksum line: ${line}`)
    const path = (match[2] as string).normalize('NFC').replace(/^dictionaries\//, '')
    entries.set(path, match[1] as string)
  }
  return entries
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export class ChecksumError extends Error {
  override name = 'ChecksumError'
}

export interface VerifiedFile {
  readonly path: string
  readonly sha256: string
  readonly bytes: number
  readonly content: Uint8Array
}

/**
 * Reads one snapshot file and proves it is the file the organisers published. Throws
 * `ChecksumError` when the manifest does not list it or the hash differs — the pipeline must never
 * derive data from a file nobody can vouch for.
 */
export function readVerified(
  snapshotDir: string,
  relativePath: string,
  expected: ReadonlyMap<string, string>,
): VerifiedFile {
  const key = relativePath.normalize('NFC')
  const want = expected.get(key)
  if (want === undefined) throw new ChecksumError(`${key} is not listed in CHECKSUMS.sha256`)
  const content = readFileSync(join(snapshotDir, relativePath))
  const got = sha256(content)
  if (got !== want) {
    throw new ChecksumError(`${key}: SHA-256 is ${got}, CHECKSUMS.sha256 says ${want}`)
  }
  return { path: key, sha256: got, bytes: content.byteLength, content }
}

/** Strict UTF-8: an invalid byte sequence throws instead of turning into U+FFFD. */
export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}
