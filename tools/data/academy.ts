import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type AcademyCourse,
  buildAcademyCourse,
  courseProblems,
  type KnowledgeLesson,
  type OrganiserCourse,
} from '../../packages/curriculum/src/academy/index'
import { layouts } from '../../packages/curriculum/src/layout/index'
import { parseNgramTable, parseWordBank } from '../../packages/curriculum/src/words/index'
import type { Language } from '../../packages/domain/src/index'
import { decodeUtf8, parseChecksums, readVerified, sha256, type VerifiedFile } from './checksums'

/**
 * The Academy step of `pnpm data`: organiser course + knowledge library + our derived word data in,
 * `data/curriculum/<lang>/{academy,report}.json` out. Every organiser file is checksum-verified
 * like the dictionaries are. Deterministic: no clock, no randomness, fixed ordering.
 *
 * Bump ACADEMY_VERSION whenever a rule or a blueprint changes what comes out.
 */
export const ACADEMY_VERSION = '1.1.0'

const SOURCES: Record<
  Language,
  { readonly course: string; readonly knowledge: string; readonly folder: string }
> = {
  uk: {
    folder: 'ukrainian',
    course: 'ukrainian/academy/typing-race-2026/course.json',
    knowledge: 'ukrainian/knowledge/typing-race-2026',
  },
  en: {
    folder: 'english',
    course: 'english/academy/typing-race-2026/course.json',
    knowledge: 'english/knowledge/typing-race-2026',
  },
}

const LAYOUT_OF = { uk: layouts.yq, en: layouts.qwerty } as const

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** `---\nfront matter\n---\nbody` → the `title:` line and the body, trimmed. */
export function parseLesson(id: string, text: string): KnowledgeLesson {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)
  if (match === null) throw new Error(`${id}: no front matter`)
  const title = /^title:\s*(.+)$/m.exec(match[1] as string)?.[1]?.trim()
  if (title === undefined) throw new Error(`${id}: no title`)
  return { id, title: title.replace(/^"|"$/g, ''), body: (match[2] as string).trim() }
}

/**
 * Builds both courses. `derived` is the in-memory output of the dictionary pipeline, keyed like
 * `uk/words.json`, so the Academy is always built from the word data of the same run.
 */
export function runAcademy(
  snapshotDir: string,
  derived: ReadonlyMap<string, string>,
): Map<string, string> {
  const checksums = parseChecksums(decodeUtf8(readFileSync(join(snapshotDir, 'CHECKSUMS.sha256'))))
  const files = new Map<string, string>()

  for (const language of ['uk', 'en'] as const) {
    const source = SOURCES[language]
    const inputs: VerifiedFile[] = []
    const read = (path: string) => {
      const file = readVerified(snapshotDir, path, checksums)
      inputs.push(file)
      return decodeUtf8(file.content)
    }

    const organiser = JSON.parse(read(source.course)) as OrganiserCourse
    const knowledge: KnowledgeLesson[] = []
    const root = join(snapshotDir, source.knowledge)
    for (const collection of readdirSync(root).sort(byCodeUnit)) {
      for (const file of readdirSync(join(root, collection)).sort(byCodeUnit)) {
        if (!file.endsWith('.md') || file.startsWith('_')) continue
        const id = `${collection}/${file.replace(/\.md$/, '')}`
        knowledge.push(parseLesson(id, read(`${source.knowledge}/${collection}/${file}`)))
      }
    }

    const words = derived.get(`${language}/words.json`)
    const ngrams = derived.get(`${language}/ngrams.json`)
    if (words === undefined || ngrams === undefined)
      throw new Error(`no derived data for ${language}`)

    const { course, report } = buildAcademyCourse({
      language,
      layout: LAYOUT_OF[language],
      organiser,
      bank: parseWordBank(JSON.parse(words)),
      ngrams: parseNgramTable(JSON.parse(ngrams)),
      knowledge,
      algorithmVersion: ACADEMY_VERSION,
    })
    const problems = courseProblems(course)
    if (problems.length > 0) {
      throw new Error(`Academy ${language} is invalid:\n  ${problems.join('\n  ')}`)
    }

    const academyJson = `${JSON.stringify(course, null, 2)}\n`
    files.set(`${language}/academy.json`, academyJson)
    files.set(
      `${language}/report.json`,
      `${JSON.stringify(
        {
          format: 'typing-race/academy-report@1',
          language,
          algorithmVersion: ACADEMY_VERSION,
          inputs: [
            ...inputs.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes })),
            {
              path: `data/derived/${language}/words.json`,
              sha256: sha256(new TextEncoder().encode(words)),
            },
            {
              path: `data/derived/${language}/ngrams.json`,
              sha256: sha256(new TextEncoder().encode(ngrams)),
            },
          ],
          rules: {
            text: 'NFC; apostrophe variants fold to U+0027; stress marks removed; dashes to hyphen, typographic quotes to straight double quote, ellipsis to three full stops; whitespace collapsed. і ї є ґ are never substituted.',
            prose:
              'Sentences and paragraphs also map ! and ? to a full stop and drop brackets, because neither layout types them here; a text that still has an untypable character is dropped whole.',
            drills: 'Drill texts keep only the tokens the layout can type.',
            generated:
              'N-gram drills: the heaviest in-word bigrams/trigrams (weight = sum of the frequencies of the words that contain them), each followed by the most frequent words containing it. Same-finger, roll (neighbouring fingers, same hand and row) and double-letter pairs are filtered from the same table; alternation words switch hands on every letter.',
          },
          counts: {
            modules: course.modules.length,
            exercises: course.modules.reduce((n, m) => n + m.exercises.length, 0),
            bySource: countBy(course),
          },
          organiserUsed: report.organiserUsed,
          organiserUnused: report.organiserUnused,
          dropped: report.dropped,
          tokensDropped: report.tokensDropped,
          outputs: { 'academy.json': { sha256: sha256(new TextEncoder().encode(academyJson)) } },
        },
        null,
        2,
      )}\n`,
    )
  }
  return files
}

function countBy(course: AcademyCourse): Record<string, number> {
  const out: Record<string, number> = {}
  for (const module of course.modules) {
    for (const exercise of module.exercises) out[exercise.source] = (out[exercise.source] ?? 0) + 1
  }
  return out
}
