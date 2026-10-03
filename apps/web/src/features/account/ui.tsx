import { Link } from '@tanstack/react-router'
import { Button, IconGoogle } from '@typing-race/ui'
import { type ReactNode, useEffect, useId, useRef } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import type { SyncStatus } from '../../sync/index.js'
import { type SyncWord, syncWord } from './model.js'
import { setNotice, signInWithGoogle, useAccount, useSyncStatus } from './state.js'
import './account.css'

/**
 * The Account's pieces that live in the frame: the status bar chip, the dialog primitive, and the
 * notices that follow a return from Google. Calm, one primary action, plain Ukrainian.
 */

// ---- Words ----------------------------------------------------------------------------------

function clock(ms: number): string {
  return new Intl.DateTimeFormat(getLocale() === 'en' ? 'en-GB' : 'uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}

export function syncText(word: SyncWord): string {
  switch (word.kind) {
    case 'off':
      return m.acct_sync_off()
    case 'syncing':
      return m.acct_sync_syncing()
    case 'offline':
      return word.pending > 0
        ? m.acct_sync_offline_pending({ n: String(word.pending) })
        : m.acct_sync_offline()
    case 'error':
      return m.acct_sync_error()
    case 'pending':
      return m.acct_sync_pending({ n: String(word.pending) })
    case 'synced':
      return word.at === null
        ? m.acct_sync_synced()
        : m.acct_sync_synced_at({ time: clock(word.at) })
  }
}

/** `ok`, `busy` or `alert` — the dot's colour, so the state is never colour alone (text says it). */
export function syncTone(word: SyncWord): 'ok' | 'busy' | 'alert' | 'off' {
  if (word.kind === 'synced') return 'ok'
  if (word.kind === 'error') return 'alert'
  if (word.kind === 'off') return 'off'
  return 'busy'
}

export function wordOf(status: SyncStatus | null): SyncWord {
  return status === null ? { kind: 'off' } : syncWord(status)
}

// ---- The status bar chip -------------------------------------------------------------------

/**
 * Signed out: «Увійти через Google». Signed in: the account chip — the sync state in words with a
 * dot, leading to the Profile's Account section. The nick and its initial sit in the bar's "who".
 */
export function AccountChip() {
  const kind = useAccount((state) => state.kind)
  const nick = useAccount((state) => state.nick)
  const busy = useAccount((state) => state.busy)
  const status = useSyncStatus()
  const id = useId()

  if (kind === 'google') {
    const word = wordOf(status)
    const text = syncText(word)
    return (
      <Link
        to="/profile"
        hash="account"
        className="gchip gchip--account"
        data-testid="account-chip"
        aria-label={m.acct_chip_label({ nick: nick ?? m.acct_you(), state: text })}
      >
        <span className="gchip__dot" data-tone={syncTone(word)} aria-hidden="true" />
        <span className="gchip__state">{text}</span>
      </Link>
    )
  }

  const label =
    busy === 'redirecting' ? m.acct_redirecting() : busy === 'returning' ? m.acct_returning() : null
  return (
    <button
      type="button"
      className="gchip gchip--signin tip"
      aria-describedby={id}
      aria-busy={busy !== null || undefined}
      disabled={busy !== null}
      data-testid="account-chip"
      onClick={() => void signInWithGoogle()}
    >
      <IconGoogle size={16} />
      {label === null ? (
        <span>
          <span className="gchip__short">{m.acct_sign_in_short()}</span>
          <span className="gchip__full">{m.acct_sign_in()}</span>
        </span>
      ) : (
        <span>{label}</span>
      )}
      <span role="tooltip" id={id} className="tip__bubble tip__bubble--end">
        {m.acct_sign_in_hint()}
      </span>
    </button>
  )
}

// ---- Dialog --------------------------------------------------------------------------------

/**
 * A modal on the native `<dialog>`: `showModal()` makes the rest of the page inert (the focus trap)
 * and Esc closes it. The first button takes focus, so Enter answers the question it asks.
 */
export function Dialog({
  title,
  onClose,
  children,
  actions,
  tone = 'calm',
  testId,
}: {
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
  readonly actions: ReactNode
  readonly tone?: 'calm' | 'danger'
  readonly testId?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    if (!dialog.open) dialog.showModal()
    const onCancel = (event: Event) => {
      event.preventDefault()
      close.current()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className="acct-dialog"
      data-tone={tone}
      aria-labelledby={titleId}
      data-testid={testId}
    >
      <h2 className="acct-dialog__title" id={titleId}>
        {title}
      </h2>
      <div className="acct-dialog__body">{children}</div>
      <div className="acct-dialog__actions">{actions}</div>
    </dialog>
  )
}

// ---- Notices after a return from Google ----------------------------------------------------

const TOAST_MS = 6000

function Toast({ text }: { readonly text: string }) {
  useEffect(() => {
    const handle = setTimeout(() => setNotice(null), TOAST_MS)
    return () => clearTimeout(handle)
  }, [])
  return (
    <div className="acct-toast" role="status" data-testid="account-toast">
      <span>{text}</span>
      <button
        type="button"
        className="acct-toast__close"
        aria-label={m.acct_close()}
        onClick={() => setNotice(null)}
      >
        ×
      </button>
    </div>
  )
}

/** Mounted once in the frame: the 422 question, a failed sign-in, and the quiet confirmations. */
export function AccountNotices() {
  const notice = useAccount((state) => state.notice)
  const dismiss = () => setNotice(null)

  switch (notice) {
    case 'identity-taken':
      return (
        <Dialog
          title={m.acct_taken_title()}
          onClose={dismiss}
          testId="account-taken"
          actions={
            <>
              <Button variant="primary" onClick={() => void signInWithGoogle('fresh')}>
                {m.acct_taken_continue()}
              </Button>
              <Button variant="quiet" onClick={dismiss}>
                {m.acct_taken_cancel()}
              </Button>
            </>
          }
        >
          <p>{m.acct_taken_body()}</p>
          <p className="acct-dialog__note">{m.acct_taken_note()}</p>
        </Dialog>
      )
    case 'failed':
    case 'no-backend':
      return (
        <Dialog
          title={notice === 'failed' ? m.acct_failed_title() : m.acct_no_backend_title()}
          onClose={dismiss}
          testId="account-failed"
          actions={
            <Button variant="secondary" onClick={dismiss}>
              {m.acct_ok()}
            </Button>
          }
        >
          <p>{notice === 'failed' ? m.acct_failed_body() : m.acct_no_backend()}</p>
        </Dialog>
      )
    case 'signed-in':
      return <Toast text={m.acct_toast_signed_in()} />
    case 'signed-out':
      return <Toast text={m.acct_toast_signed_out()} />
    case 'deleted':
      return <Toast text={m.acct_toast_deleted()} />
    case 'deleted-guest':
      return <Toast text={m.acct_toast_deleted_guest()} />
    default:
      return null
  }
}
