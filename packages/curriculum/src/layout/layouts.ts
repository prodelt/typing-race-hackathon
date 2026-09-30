import type { Layout } from '@typing-race/domain'
import { qwertyAnchors, qwertyKeys } from './qwerty'
import { deriveUnlockOrder } from './unlock-order'
import { yqAnchors, yqKeys } from './yq'

/**
 * The two layouts. The Unlock Order is derived here, once, from the finger map — and then pinned
 * by a literal in the tests, which is what "derived, then frozen" means in research R7.
 */
export const layouts: Record<'yq' | 'qwerty', Layout> = {
  yq: {
    id: 'yq',
    language: 'uk',
    keys: yqKeys,
    homeAnchors: yqAnchors,
    unlockOrder: deriveUnlockOrder(yqKeys, yqAnchors),
  },
  qwerty: {
    id: 'qwerty',
    language: 'en',
    keys: qwertyKeys,
    homeAnchors: qwertyAnchors,
    unlockOrder: deriveUnlockOrder(qwertyKeys, qwertyAnchors),
  },
}
