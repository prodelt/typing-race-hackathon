import { describe, expect, it } from 'vitest'
import { cueAllowed } from './sound.js'

describe('when a cue may play', () => {
  it('needs the learner to have asked for sound', () => {
    expect(cueAllowed({ motion: 'reduced', sound: 'off' })).toBe(false)
    expect(cueAllowed({ motion: 'reduced', sound: 'on' })).toBe(true)
  })

  it('never plays with motion off, whatever the sound setting says (FR-064)', () => {
    expect(cueAllowed({ motion: 'off', sound: 'on' })).toBe(false)
  })
})
