import type { MotionSetting } from '@typing-race/domain'

/**
 * T028. The motion flag — `docs/design/motion.md`, FR-064.
 *
 * One resolved value drives three things at once: every duration token, whether the confetti
 * module is imported at all, and whether sound plays. They are one switch rather than three
 * because a learner who turns motion off and still hears a chime has not been listened to, and
 * because a screenshot comparison is only deterministic when *all three* are off together.
 */

export type ResolvedMotion = 'full' | 'reduced' | 'off'

/**
 * `system` follows `prefers-reduced-motion`, which is the operating system's answer to a question
 * we would otherwise ask the learner twice. It resolves to `reduced`, never to `off`: the OS
 * setting means "less movement", and silently disabling sound as well would be an overreach.
 */
export function resolveMotion(setting: MotionSetting, prefersReduced: boolean): ResolvedMotion {
  if (setting === 'off') return 'off'
  if (setting === 'reduced') return 'reduced'
  return prefersReduced ? 'reduced' : 'full'
}

/** The `data-motion` attribute value for `<html>`; `tokens.css` keys the duration overrides off it. */
export function motionAttribute(resolved: ResolvedMotion): ResolvedMotion {
  return resolved
}

/**
 * Celebration moments — the confetti burst, the unlock card's spring, the race-finish glow — run
 * only at `full`. Asking this *before* the dynamic import is the point: at `reduced` or `off` the
 * canvas-confetti chunk is never fetched, so the flag is a bundle decision and not just a visual
 * one (ticket 15's 150 KB budget).
 */
export function allowsCelebration(resolved: ResolvedMotion): boolean {
  return resolved === 'full'
}

/** Sound is off unless motion is fully on *and* the learner asked for it. */
export function allowsSound(resolved: ResolvedMotion, soundSetting: 'on' | 'off'): boolean {
  return resolved !== 'off' && soundSetting === 'on'
}

/**
 * Reads the media query behind a seam-shaped function so a test can supply the answer. Callers in
 * the app pass `prefersReducedMotion()`; tests pass a literal.
 */
export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== 'function') return false
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * The motion level the document is showing right now, read from the `data-motion` attribute the
 * app writes on `<html>`. For code that runs outside React's state (a canvas loop, a scroll
 * reveal) and must obey the same switch as the CSS. Without a document, or before the attribute is
 * written, it answers from the media query alone.
 */
export function currentMotion(): ResolvedMotion {
  if (typeof document === 'undefined') return 'full'
  const value = document.documentElement.dataset['motion']
  if (value === 'full' || value === 'reduced' || value === 'off') return value
  return prefersReducedMotion() ? 'reduced' : 'full'
}

/**
 * Calls `onChange` whenever the document's motion level changes, whether the learner flipped the
 * setting or the operating system did. Returns an unsubscribe.
 */
export function watchMotion(onChange: (motion: ResolvedMotion) => void): () => void {
  if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return () => {}
  const observer = new MutationObserver(() => onChange(currentMotion()))
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  return () => observer.disconnect()
}
