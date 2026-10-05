/**
 * A key an overlay takes before the screen under it can (the coach-marks' Esc). It is read in the
 * capture phase on the document, so it arrives wherever focus is, and stopped there, so the
 * screen's own shortcut for the same key never sees it.
 *
 * An accelerator, not typing: it reads no character and feeds no engine, and overlays are never
 * mounted during an attempt, whose input path stays `domInputSource` alone.
 *
 * Imported straight from this file rather than through `index.ts`, so it travels with the lazy
 * chunk that uses it instead of the initial one.
 *
 * Returns the release.
 */
export function takeKey(key: string, handler: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== key) return
    event.preventDefault()
    event.stopPropagation()
    handler()
  }
  document.addEventListener('keydown', onKeyDown, true)
  return () => document.removeEventListener('keydown', onKeyDown, true)
}
