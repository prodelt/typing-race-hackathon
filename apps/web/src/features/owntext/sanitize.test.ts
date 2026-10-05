import { describe, expect, it } from 'vitest'
import {
  cutAtSentence,
  decodeFile,
  judgeText,
  normalise,
  OWN_TEXT_MAX_BYTES,
  stripMarkdown,
} from './sanitize.js'

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)
const latin = (char: string): boolean => /^[a-zA-Z.,!?'"\-;:()]$/.test(char)

describe('decodeFile', () => {
  it('reads a UTF-8 .txt file', () => {
    expect(decodeFile('a.TXT', encode('Привіт, світе'))).toEqual({
      ok: true,
      text: 'Привіт, світе',
    })
  })

  it('rejects other extensions', () => {
    expect(decodeFile('a.pdf', encode('x'))).toEqual({ ok: false, reason: 'type' })
  })

  it('rejects a file over the size limit', () => {
    expect(decodeFile('a.txt', new Uint8Array(OWN_TEXT_MAX_BYTES + 1))).toEqual({
      ok: false,
      reason: 'size',
    })
  })

  it('rejects invalid UTF-8 and NUL bytes', () => {
    expect(decodeFile('a.txt', new Uint8Array([0xff, 0xfe, 0x00]))).toEqual({
      ok: false,
      reason: 'encoding',
    })
    expect(decodeFile('a.txt', new Uint8Array([0x61, 0x00, 0x62]))).toEqual({
      ok: false,
      reason: 'encoding',
    })
  })

  it('strips markdown from a .md file', () => {
    const verdict = decodeFile('notes.md', encode('# Title\n\n- **bold** [link](http://x.y)'))
    expect(verdict.ok && normalise(verdict.text)).toBe('Title bold link')
  })
})

describe('stripMarkdown', () => {
  it('keeps link text, drops fences, quotes and emphasis', () => {
    const text = '```js\ncode\n```\n> *quote* and `tick`\n1. item <b>x</b>'
    expect(normalise(stripMarkdown(text))).toBe('code quote and tick item x')
  })
})

describe('normalise', () => {
  it('turns typographic marks into keyboard characters', () => {
    expect(normalise('«Так» — “ні”… it’s ok\r\n')).toBe('"Так" - "ні"... it\'s ok')
  })
})

describe('cutAtSentence', () => {
  it('cuts at the last sentence end within the limit', () => {
    expect(cutAtSentence('One two. Three four five.', 20)).toBe('One two.')
  })

  it('falls back to a word end', () => {
    expect(cutAtSentence('aaaa bbbb cccc', 11)).toBe('aaaa bbbb')
  })
})

describe('judgeText', () => {
  it('accepts a text the layout can type', () => {
    expect(judgeText('Hello, world!', latin)).toEqual({
      ok: true,
      text: 'Hello, world!',
      cut: false,
    })
  })

  it('rejects an empty text', () => {
    expect(judgeText(' \n\t ', latin)).toEqual({ ok: false, reason: 'empty' })
  })

  it('names the characters the layout cannot type', () => {
    expect(judgeText('Hi Привіт €', latin)).toEqual({
      ok: false,
      reason: 'unsupported',
      chars: ['П', 'р', 'и', 'в', 'і', 'т', '€'],
    })
  })
})
