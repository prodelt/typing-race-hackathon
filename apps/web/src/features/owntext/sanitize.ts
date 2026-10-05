/**
 * Own text: the learner's pasted text or `.txt`/`.md` file, turned into a line the engine can run.
 * Pure functions only, so the rules are tested without a browser.
 */

/** The largest file read, in bytes. */
export const OWN_TEXT_MAX_BYTES = 20_000
/** The longest line typed; a longer text is cut at a sentence boundary. */
export const OWN_TEXT_MAX_CHARS = 3_000
/** How many unsupported characters an error names. */
const MAX_NAMED = 10

export type FileVerdict =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: 'type' | 'size' | 'encoding' }

export type TextVerdict =
  | { readonly ok: true; readonly text: string; readonly cut: boolean }
  | { readonly ok: false; readonly reason: 'empty' }
  | { readonly ok: false; readonly reason: 'unsupported'; readonly chars: readonly string[] }

/** Reads a picked file: `.txt`/`.md` only, within the size limit, strict UTF-8, no NUL bytes. */
export function decodeFile(name: string, bytes: Uint8Array): FileVerdict {
  const lower = name.toLowerCase()
  const markdown = lower.endsWith('.md')
  if (!markdown && !lower.endsWith('.txt')) return { ok: false, reason: 'type' }
  if (bytes.byteLength > OWN_TEXT_MAX_BYTES) return { ok: false, reason: 'size' }
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { ok: false, reason: 'encoding' }
  }
  if (text.includes('\u0000')) return { ok: false, reason: 'encoding' }
  return { ok: true, text: markdown ? stripMarkdown(text) : text }
}

/** Drops markdown markup and keeps the words: link text stays, targets and marks go. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^\s*(```|~~~).*$/gm, '')
    .replace(/^\s*([-*_]\s*){3,}$/gm, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__|~~|\*|`)/g, '')
    .replace(/(^|\s)_(\S[^_]*?)_(?=\s|$|[.,!?;:])/g, '$1$2')
}

const REPLACEMENTS: readonly (readonly [RegExp, string])[] = [
  [/[“”„‟«»″]/g, '"'],
  [/[‘’‚‛ʼ′]/g, "'"],
  [/[‐‑‒–—―−]/g, '-'],
  [/…/g, '...'],
  [/­|​|‌|‍|﻿/g, ''],
  [/\s+/g, ' '],
]

/** Typographic quotes, dashes, ellipsis and odd spaces become keyboard characters; one space between words. */
export function normalise(text: string): string {
  let out = text.normalize('NFC')
  for (const [pattern, to] of REPLACEMENTS) out = out.replace(pattern, to)
  return out.trim()
}

/** Cuts a long text at the last sentence end (or word end) within the limit. */
export function cutAtSentence(text: string, max = OWN_TEXT_MAX_CHARS): string {
  if (text.length <= max) return text
  const head = text.slice(0, max + 1)
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
  if (sentence > 0) return head.slice(0, sentence + 1)
  const space = head.lastIndexOf(' ')
  return (space > 0 ? head.slice(0, space) : head.slice(0, max)).trim()
}

/**
 * The verdict on a text for the active layout: normalised and cut, or the reason it cannot be
 * typed — naming up to ten characters the layout has no key for.
 */
export function judgeText(raw: string, supports: (char: string) => boolean): TextVerdict {
  const normal = normalise(raw)
  if (normal === '') return { ok: false, reason: 'empty' }
  const missing = new Set<string>()
  for (const char of normal) {
    if (char !== ' ' && !supports(char)) missing.add(char)
  }
  if (missing.size > 0) {
    return { ok: false, reason: 'unsupported', chars: [...missing].slice(0, MAX_NAMED) }
  }
  const text = cutAtSentence(normal)
  return { ok: true, text, cut: text.length < normal.length }
}
