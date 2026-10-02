import { useEffect, useRef } from 'react'

/**
 * A screen's single-key shortcuts (Home, the result), matched on `event.code` so they sit on the same physical key in
 * ЙЦУКЕН and QWERTY. A key typed into a field or held with a modifier is left alone, and so is Enter
 * while a link or button has focus, where it already means "activate this".
 */
export function useScreenKeys(handlers: Readonly<Record<string, () => void>>): void {
  const current = useRef(handlers)
  current.current = handlers

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.isContentEditable) return
        if (target.closest('input, textarea, select, dialog, [role="dialog"]') !== null) return
        if (event.code === 'Enter' && target.closest('a, button, summary') !== null) return
      }
      const handler = current.current[event.code]
      if (handler === undefined) return
      event.preventDefault()
      handler()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
