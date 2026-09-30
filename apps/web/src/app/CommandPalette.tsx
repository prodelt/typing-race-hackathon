import { useNavigate } from '@tanstack/react-router'
import { Button, cx } from '@typing-race/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { m } from '../paraglide/messages.js'
import { useAppStore, useDerived } from './state/index.js'

/**
 * T063. The keyboard-first command palette, reachable from every screen (FR-056).
 *
 * It is not a search box over a menu. This product's whole premise is that a learner's hands stay
 * on the home row, so anything reachable only by pointer is a small betrayal of the lesson. Ctrl+K
 * opens it, typing filters, Enter runs, Escape closes.
 *
 * It does **not** open during an attempt. FR-069 forbids any DOM change outside the typing line
 * between two keystrokes, and a dialog is the largest change there is.
 */

interface Command {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly run: () => void
}

export function CommandPalette() {
  const navigate = useNavigate()
  const attemptInProgress = useAppStore((state) => state.attemptInProgress)
  const changeSettings = useAppStore((state) => state.changeSettings)
  const settings = useAppStore((state) => state.settings)
  const { nextAction } = useDerived()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'today', label: m.cmd_today(), run: () => void navigate({ to: '/today' }) },
      { id: 'path', label: m.cmd_path(), run: () => void navigate({ to: '/path' }) },
      { id: 'settings', label: m.cmd_settings(), run: () => void navigate({ to: '/settings' }) },
      { id: 'formulas', label: m.cmd_formulas(), run: () => void navigate({ to: '/formulas' }) },
      {
        id: 'theme',
        label: m.cmd_toggle_theme(),
        hint: settings.theme,
        run: () => void changeSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }),
      },
      {
        id: 'motion',
        label: m.cmd_toggle_motion(),
        hint: settings.motion,
        run: () => void changeSettings({ motion: settings.motion === 'off' ? 'system' : 'off' }),
      },
    ]

    if (nextAction !== null) {
      // The one next action is the palette's first entry when there is one, because it is the
      // one thing the product ever asks the learner to do (FR-031).
      list.unshift({
        id: 'next-action',
        label: m.cmd_next_action(),
        run: () =>
          void navigate({
            to: '/exercise/$scaleId',
            params: { scaleId: nextAction.startsScaleId },
            search: { mode: 'practice' },
          }),
      })
    }
    return list
  }, [navigate, changeSettings, settings.theme, settings.motion, nextAction])

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (needle === '') return commands
    return commands.filter((command) => command.label.toLocaleLowerCase().includes(needle))
  }, [commands, query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setHighlighted(0)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (attemptInProgress) return
        event.preventDefault()
        setOpen((previous) => !previous)
      }
      if (event.key === 'Escape') close()
    }
    // On the window, not on a node: FR-056 says "from every screen", and a listener on a mounted
    // panel would only work once the panel exists.
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [attemptInProgress, close])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) return null

  const run = (command: Command | undefined) => {
    if (command === undefined) return
    command.run()
    close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 pt-[12vh]">
      {/* No click-to-close backdrop. A full-screen div with a mouse handler is either an
          accessibility defect or a fake button, and this palette is keyboard-first by design:
          Escape closes it from anywhere, and the button below is there for a pointer. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={m.command_palette_title()}
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border-[length:var(--border-hairline)] border-hairline bg-paper-raised shadow-[var(--shadow-raised)]"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setHighlighted(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setHighlighted((index) => Math.min(index + 1, matches.length - 1))
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHighlighted((index) => Math.max(index - 1, 0))
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              run(matches[highlighted])
            }
          }}
          placeholder={m.command_palette_placeholder()}
          aria-label={m.command_palette_title()}
          className="w-full border-b-[length:var(--border-hairline)] border-hairline bg-transparent px-4 py-3 font-ui text-ink outline-none"
        />

        {matches.length === 0 ? (
          <p className="px-4 py-6 text-center font-ui text-sm text-muted">
            {m.command_palette_empty()}
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {matches.map((command, index) => (
              <li key={command.id}>
                <Button
                  variant="quiet"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => run(command)}
                  className={cx(
                    'w-full justify-between rounded-none px-4 font-normal',
                    index === highlighted && 'bg-sage-tint',
                  )}
                >
                  <span>{command.label}</span>
                  {command.hint !== undefined && (
                    <span className="font-mono text-xs text-muted">{command.hint}</span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t-[length:var(--border-hairline)] border-hairline px-4 py-2">
          <span className="font-mono text-xs text-muted">{m.command_palette_hint()}</span>
          <Button variant="quiet" onClick={close}>
            {m.command_palette_close()}
          </Button>
        </div>
      </div>
    </div>
  )
}
