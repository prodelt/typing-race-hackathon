import type { Key } from '@typing-race/domain'
import type { Generator } from '../types'
import { isAvailable } from './shared'

/**
 * `fingerSpan` — one finger across every key assigned to it, digraph by digraph (R6). This is the
 * only generator that reaches the index fingers' six-key spans (`R F V T G B`), which is why it is
 * not folded into `vertical`. A finger with fewer than two available keys has no span to drill.
 */
export const fingerSpan: Generator = (context) => {
  const { layout } = context
  const byFinger = new Map<string, Key[]>()
  for (const key of layout.keys) {
    if (key.kind !== 'letter' && !layout.homeAnchors.includes(key.plain)) continue
    if (!isAvailable(context, key)) continue
    const id = `${key.hand}/${key.finger}`
    const group = byFinger.get(id)
    if (group === undefined) byFinger.set(id, [key])
    else group.push(key)
  }
  const digraphs = [...byFinger.values()].flatMap((keys) =>
    keys.flatMap((first) =>
      keys.filter((second) => second !== first).map((second) => `${first.plain}${second.plain}`),
    ),
  )
  return context.forms.flatMap((form) => digraphs.map((digraph) => `${digraph}${digraph}${form}`))
}
