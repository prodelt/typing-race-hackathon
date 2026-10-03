import type { Settings } from '@typing-race/domain'
import { allowsSound, prefersReducedMotion, resolveMotion } from '@typing-race/ui'

/**
 * The app's only sounds: a short chime when a result opens and a rising one when a key unlocks. They
 * are synthesised, so there is no audio file to ship or license, and they play only when the
 * learner asked for them and motion is not off (`allowsSound`, FR-064). Never during typing.
 */
export type Cue = 'result' | 'unlock'

/** Pitches of each cue in Hz: C5-E5, and C5-E5-G5. */
const NOTES: Record<Cue, readonly number[]> = {
  result: [523.25, 659.25],
  unlock: [523.25, 659.25, 783.99],
}
const NOTE_SECONDS = 0.14
const VOLUME = 0.06

export function cueAllowed(settings: Pick<Settings, 'motion' | 'sound'>): boolean {
  return allowsSound(resolveMotion(settings.motion, prefersReducedMotion()), settings.sound)
}

let context: AudioContext | null = null

export function playCue(cue: Cue, settings: Pick<Settings, 'motion' | 'sound'>): void {
  if (!cueAllowed(settings)) return
  try {
    const Context =
      globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Context === undefined) return
    context ??= new Context()
    const audio = context
    if (audio.state === 'suspended') void audio.resume()
    const start = audio.currentTime
    for (const [index, frequency] of NOTES[cue].entries()) {
      const at = start + index * NOTE_SECONDS
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      // A soft attack and a fade keep it from clicking.
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(VOLUME, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_SECONDS * 1.6)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(at)
      oscillator.stop(at + NOTE_SECONDS * 1.7)
    }
  } catch {
    // A browser that refuses audio simply stays quiet.
  }
}
