import type { Settings } from '@typing-race/domain'
import { prefersReducedMotion, resolveMotion } from '@typing-race/ui'

/**
 * T061. Theme and motion, applied to `<html>` at boot and on every settings change.
 *
 * Attributes rather than classes, because that is what `tokens.css` and `themes.css` key off
 * (research R2), and one attribute swap re-themes the whole document without a re-render.
 *
 * Applied **before first paint** — `main.tsx` calls this before mounting React. A frame of the
 * light theme on the way to the dark one is the kind of flash a learner notices at 7am and
 * nothing in the test suite would ever catch.
 */

export type ResolvedTheme = 'light' | 'dark' | 'low-vision'

/**
 * `system` is resolved here rather than stored, so a learner who follows the operating system
 * sees it change under them without visiting settings.
 */
export function resolveTheme(setting: Settings['theme'], prefersDark: boolean): ResolvedTheme {
  if (setting === 'light') return 'light'
  if (setting === 'dark') return 'dark'
  if (setting === 'lowVision') return 'low-vision'
  return prefersDark ? 'dark' : 'light'
}

export function prefersDarkScheme(): boolean {
  if (typeof matchMedia !== 'function') return false
  return matchMedia('(prefers-color-scheme: dark)').matches
}

export interface ThemeEnvironment {
  readonly prefersDark: boolean
  readonly prefersReduced: boolean
}

export function readEnvironment(): ThemeEnvironment {
  return { prefersDark: prefersDarkScheme(), prefersReduced: prefersReducedMotion() }
}

/**
 * Writes the four presentation attributes. `--text-typing` is a setting rather than a token
 * constant, because FR-049 lets the learner size the typing line between 24 and 40 px and that
 * has to survive a reload.
 */
export function applyPresentation(settings: Settings, environment: ThemeEnvironment): void {
  const root = document.documentElement
  const theme = resolveTheme(settings.theme, environment.prefersDark)
  if (root.dataset['theme'] !== theme) {
    // A theme change is a swap, never a fade. Boot paints the default theme and the stored one
    // arrives from IndexedDB a moment later; without this, every `transition: color` in the
    // frame would fade from light to dark on each load (WebKit keeps those transitions alive for
    // hundreds of milliseconds even at the motion-off duration). `data-theme-swap` turns
    // transitions off (themes.css), the forced style flush makes the swap land under it, and
    // removing it again leaves nothing to animate because nothing changes after that.
    root.dataset['themeSwap'] = ''
    root.dataset['theme'] = theme
    void getComputedStyle(root).color
    void document.body?.offsetHeight
    delete root.dataset['themeSwap']
  }
  root.dataset['motion'] = resolveMotion(settings.motion, environment.prefersReduced)
  root.dataset['sound'] = settings.sound
  root.style.setProperty('--text-typing', `${settings.textSizePx}px`)
  root.lang = settings.interfaceLanguage
}

/**
 * Follows the operating system while the learner's own setting is `system`. Returns an unsubscribe
 * so a test can tear it down; the app never does, because it lives as long as the document.
 */
export function watchSystemPreferences(
  onChange: (environment: ThemeEnvironment) => void,
): () => void {
  if (typeof matchMedia !== 'function') return () => {}

  const dark = matchMedia('(prefers-color-scheme: dark)')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const handler = () => {
    onChange(readEnvironment())
  }

  dark.addEventListener('change', handler)
  reduced.addEventListener('change', handler)
  return () => {
    dark.removeEventListener('change', handler)
    reduced.removeEventListener('change', handler)
  }
}
