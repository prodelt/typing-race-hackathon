import type { LayoutId } from '@typing-race/domain'

const CYRILLIC = /[Ѐ-ӿ]/

/** What `navigator.keyboard.getLayoutMap()` shows. It is **not** the active layout (see below). */
export type LayoutMapShape = 'ukrainian' | 'cyrillic' | 'latin'

/**
 * Reads the shape of a `getLayoutMap()` result.
 *
 * The map is not the Active layout. The Keyboard Map spec and Chromium return the highest-priority
 * *ASCII-capable* layout, so on a machine with US and Ukrainian both installed `KeyF` is «f» whichever
 * of the two is active. A Latin map therefore proves nothing about what the learner is typing in. A
 * Cyrillic map is different: it appears only when no Latin layout is installed at all.
 *
 * Within Cyrillic, `KeyF` is «а» on both Ukrainian and Russian, so it cannot tell them apart. Three
 * keys do, and they are the same on Windows, macOS and Linux: `KeyS` is `і`, `BracketRight` is `ї`
 * and `Quote` is `є` on Ukrainian.
 *
 * `undefined` when the map has no `KeyF`: the page cannot tell.
 */
export function shapeOfLayoutMap(map: ReadonlyMap<string, string>): LayoutMapShape | undefined {
  const home = map.get('KeyF')
  if (home === undefined) return undefined
  if (!CYRILLIC.test(home)) return 'latin'
  const ukrainian =
    map.get('KeyS')?.toLowerCase() === 'і' ||
    map.get('BracketRight')?.toLowerCase() === 'ї' ||
    map.get('Quote')?.toLowerCase() === 'є'
  return ukrainian ? 'ukrainian' : 'cyrillic'
}

/**
 * Whether the map *proves* the learner cannot type `expected`. Only two cases do:
 * - a Ukrainian text on a machine whose only layouts are Cyrillic but not Ukrainian (Russian only);
 * - an English text on a machine with no Latin layout installed.
 * A Latin map against a Ukrainian text proves nothing and is not reported: Ukrainian may be one
 * keypress away, and telling people who are on it that they are not is worse than saying nothing.
 */
export function provesUnproducible(shape: LayoutMapShape, expected: LayoutId): boolean {
  return expected === 'yq' ? shape === 'cyrillic' : shape !== 'latin'
}
