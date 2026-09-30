import type { Layout } from '@typing-race/domain'
import { describe, expect, it } from 'vitest'
import { initialUnlockedSet, layouts, SHIFT_TOKEN } from '../layout'
import { buildCatalogue, catalogue, SCALE_GOAL_KEYS } from './catalogue'
import { SCALE_TYPES } from './types'

const both = [layouts.yq, layouts.qwerty] as const

describe.each(both)('the Scale Catalogue for $id', (layout) => {
  const scales = catalogue[layout.id]

  it('holds all eight generator types (SC-003, FR-008)', () => {
    expect(new Set(scales.map((scale) => scale.type))).toEqual(new Set(SCALE_TYPES))
  })

  it('gives every scale a stable, unique id and this layout', () => {
    const ids = scales.map((scale) => scale.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const scale of scales) {
      expect(scale.layoutId).toBe(layout.id)
      expect(scale.id.startsWith(`${layout.id}.${scale.type}.`)).toBe(true)
    }
  })

  it('states one goal message key per scale (FR-010)', () => {
    for (const scale of scales) {
      expect(scale.goal).toBe(SCALE_GOAL_KEYS[scale.type])
      expect(scale.goal).toMatch(/^scale_goal_[a-z_]+$/)
    }
  })

  it('sets a tempo only on tempo scales, and never as a pass mark', () => {
    for (const scale of scales) {
      if (scale.type === 'tempo') expect(scale.targetSpm).toBeGreaterThan(0)
      else expect(scale.targetSpm).toBeNull()
    }
  })

  it('names what each scale exercises, and a positive size', () => {
    for (const scale of scales) {
      expect(scale.fingers.length, scale.id).toBeGreaterThan(0)
      expect(scale.size).toBeGreaterThan(0)
      expect(scale.focus.kind).toBe('key')
    }
  })

  it('never requires an anchor, the space bar or a key the scale itself teaches', () => {
    for (const scale of scales) {
      for (const need of scale.requires) {
        expect(layout.homeAnchors).not.toContain(need)
        expect(need).not.toBe(' ')
        expect(need).not.toBe(scale.focus.value)
      }
    }
  })

  it('has a scale for every entry of the Unlock Order, first in catalogue order (FR-041)', () => {
    let previous = -1
    for (const entry of layout.unlockOrder) {
      const index = scales.findIndex((scale) => scale.focus.value === entry)
      expect(index, `no scale for ${entry}`).toBeGreaterThan(previous)
      previous = index
    }
  })

  it('requires only keys that unlock before the scale`s own focus', () => {
    for (const scale of scales) {
      const at = layout.unlockOrder.indexOf(scale.focus.value)
      if (at < 0) {
        expect(scale.requires, scale.id).toEqual([])
        continue
      }
      for (const need of scale.requires) {
        const position = layout.unlockOrder.indexOf(need)
        expect(position, `${scale.id} requires ${need}`).toBeGreaterThanOrEqual(0)
        expect(position).toBeLessThan(at)
      }
    }
  })

  it('offers the five anchor-only scales before anything is unlocked', () => {
    const anchors = scales.filter((scale) => scale.id.endsWith('.anchors'))
    expect(anchors.map((scale) => scale.type).sort()).toEqual(
      ['alternate', 'fingerIsolation', 'mirror', 'run', 'tempo'].sort(),
    )
    for (const scale of anchors) expect(layout.homeAnchors).toContain(scale.focus.value)
  })

  it('teaches Shift with a modifiers scale on the Shift entry', () => {
    const shift = scales.find((scale) => scale.focus.value === SHIFT_TOKEN)
    expect(shift?.type).toBe('modifiers')
    expect(shift?.fingers.map((f) => f.hand).sort()).toEqual(['left', 'right'])
  })

  it('starts from the anchors: the initial set is exactly the anchors and space', () => {
    expect(initialUnlockedSet(layout)).toHaveLength(9)
  })
})

describe('buildCatalogue', () => {
  it('rejects an Unlock Order entry no key produces, rather than inventing a scale', () => {
    const corrupt: Layout = {
      ...layouts.qwerty,
      unlockOrder: [...layouts.qwerty.unlockOrder, '§'],
    }
    expect(() => buildCatalogue(corrupt)).toThrow(/§/)
  })

  it('agrees with the exported catalogue', () => {
    expect(buildCatalogue(layouts.yq)).toEqual(catalogue.yq)
    expect(buildCatalogue(layouts.qwerty)).toEqual(catalogue.qwerty)
  })
})

describe('the goal message keys', () => {
  it('are distinct, one per type', () => {
    expect(new Set(Object.values(SCALE_GOAL_KEYS)).size).toBe(8)
    expect(Object.keys(SCALE_GOAL_KEYS).sort()).toEqual([...SCALE_TYPES].sort())
  })
})
