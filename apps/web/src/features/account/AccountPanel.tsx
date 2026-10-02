import { Button } from '@typing-race/ui'
import { type FormEvent, useId, useReducer, useRef, useState } from 'react'
import { Panel } from '../../app/Screen.js'
import { m } from '../../paraglide/messages.js'
import {
  NICK_MAX,
  NickError,
  setAccountNick,
  startSync,
  syncNow,
  syncStatus,
  wipeLocalIfSynced,
} from '../../sync/index.js'
import { deleteStep, initialOf, signOutStep } from './model.js'
import { setNotice, signInWithGoogle, useAccount, useSyncStatus } from './state.js'
import { Dialog, syncText, syncTone, wordOf } from './ui.js'

/**
 * Profile, panel 05: the Account. A guest sees one calm offer to sign in and what stays private.
 * A signed-in learner sees their public nick (editable), their Google email — shown here only, to
 * the owner, never anywhere public — the sync state, and the two ways out: sign out, which keeps
 * the cloud copy and clears this browser, and "delete my data", which removes everything.
 */

const auth = () => import('./auth.js')

export function AccountPanel() {
  const kind = useAccount((state) => state.kind)
  const signedIn = kind === 'google'
  return (
    <Panel
      id="prof-account-title"
      n={5}
      title={m.prof_account_title()}
      meta={signedIn ? <SyncState /> : <SignInButton />}
      className="prof-account"
      testId="profile-account"
    >
      <div id="account" className="acct">
        {signedIn ? <SignedIn /> : <SignedOut />}
      </div>
    </Panel>
  )
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"
      />
      <path
        fill="#FBBC05"
        d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  )
}

/* ---- Signed out ------------------------------------------------------------------------------ */

function SignInButton() {
  const busy = useAccount((state) => state.busy)
  return (
    <button
      type="button"
      className="prof-google acct-google"
      disabled={busy !== null}
      aria-busy={busy !== null || undefined}
      onClick={() => void signInWithGoogle()}
      data-testid="profile-sign-in"
    >
      <GoogleMark />
      {busy === 'redirecting'
        ? m.acct_redirecting()
        : busy === 'returning'
          ? m.acct_returning()
          : m.acct_sign_in()}
    </button>
  )
}

function SignedOut() {
  const kind = useAccount((state) => state.kind)
  const nick = useAccount((state) => state.nick)
  return (
    <>
      <p className="scr-say">
        {kind === 'anonymous' && nick !== null ? m.acct_anon_body({ nick }) : m.acct_guest_body()}
      </p>
      <p className="scr-note acct-privacy">{m.acct_privacy()}</p>
    </>
  )
}

/* ---- Signed in ------------------------------------------------------------------------------- */

/** The sync state in the panel head: a dot and the words. */
function SyncState() {
  const word = wordOf(useSyncStatus())
  return (
    <span className="acct-sync">
      <span className="gchip__dot" data-tone={syncTone(word)} aria-hidden="true" />
      <span data-testid="account-sync">{syncText(word)}</span>
    </span>
  )
}

/** "Sync now", offered only when it would change something. */
function SyncNow() {
  const word = wordOf(useSyncStatus())
  if (word.kind !== 'error' && word.kind !== 'pending' && word.kind !== 'off') return null
  return (
    <Button
      variant="quiet"
      size="sm"
      className="acct-inline"
      onClick={() => void (word.kind === 'off' ? startSync() : syncNow())}
    >
      {m.acct_sync_now()}
    </Button>
  )
}

function SignedIn() {
  const nick = useAccount((state) => state.nick)
  const email = useAccount((state) => state.email)
  const status = useSyncStatus()
  const word = wordOf(status)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const rejected = status?.lastRejections.length ?? 0

  return (
    <>
      <div className="acct-id">
        <span className="acct-id__avatar" aria-hidden="true">
          {initialOf(nick ?? '?')}
        </span>
        <div className="acct-id__text">
          {editing ? (
            <NickForm
              current={nick ?? ''}
              onDone={(didSave) => {
                setEditing(false)
                setSaved(didSave)
              }}
            />
          ) : (
            <span className="acct-nick">
              <b data-testid="account-nick">{nick ?? '—'}</b>
              <span className="acct-nick__hint">{m.acct_nick_public()}</span>
              <Button
                variant="quiet"
                size="sm"
                className="acct-inline"
                onClick={() => {
                  setSaved(false)
                  setEditing(true)
                }}
              >
                {m.acct_nick_edit()}
              </Button>
              {saved ? (
                <span role="status" className="acct-ok">
                  {m.acct_nick_saved()}
                </span>
              ) : null}
            </span>
          )}
          {email === null ? null : (
            <span className="acct-email">
              <span data-testid="account-email">{email}</span>
              {' · '}
              {m.acct_email_private()}
            </span>
          )}
        </div>
      </div>
      {word.kind === 'error' ? <p className="scr-note">{m.acct_sync_error_body()}</p> : null}
      {rejected > 0 ? (
        <p className="scr-note">{m.acct_sync_rejected({ n: String(rejected) })}</p>
      ) : null}
      <div className="acct-actions">
        <SignOut />
        <SyncNow />
        <DeleteData />
      </div>
    </>
  )
}

function NickForm({
  current,
  onDone,
}: {
  readonly current: string
  readonly onDone: (saved: boolean) => void
}) {
  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()
  const kind = useAccount((state) => state.kind)
  const email = useAccount((state) => state.email)
  const input = useRef<HTMLInputElement>(null)

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (value.trim() === current) {
      onDone(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const stored = await setAccountNick(value)
      ;(await auth()).nickSaved(stored, kind === 'unknown' ? 'google' : kind, email)
      onDone(true)
    } catch (caught) {
      setSaving(false)
      const code = caught instanceof NickError ? caught.code : null
      setError(
        code === 'taken'
          ? m.acct_nick_taken()
          : code === 'invalid'
            ? m.acct_nick_invalid()
            : code === 'signed-out'
              ? m.acct_nick_signed_out()
              : m.acct_nick_failed(),
      )
      input.current?.focus()
    }
  }

  return (
    <form
      className="acct-nickform"
      onSubmit={(event) => void submit(event)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDone(false)
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {m.acct_nick()}
      </label>
      <input
        ref={input}
        id={inputId}
        className="acct-input"
        value={value}
        maxLength={NICK_MAX}
        autoComplete="nickname"
        spellCheck={false}
        // biome-ignore lint/a11y/noAutofocus: the field appears because the learner asked to edit it
        autoFocus
        aria-invalid={error !== null || undefined}
        aria-describedby={error === null ? undefined : errorId}
        onChange={(event) => setValue(event.target.value)}
        data-testid="account-nick-input"
      />
      <Button type="submit" variant="secondary" size="sm" disabled={saving}>
        {saving ? m.acct_nick_saving() : m.acct_nick_save()}
      </Button>
      <Button
        variant="quiet"
        size="sm"
        className="acct-inline"
        onClick={() => onDone(false)}
        disabled={saving}
      >
        {m.acct_nick_cancel()}
      </Button>
      {error === null ? null : (
        <p id={errorId} role="alert" className="acct-error">
          {error}
        </p>
      )}
    </form>
  )
}

/* ---- Sign out ------------------------------------------------------------------------------- */

function SignOut() {
  const [state, dispatch] = useReducer(signOutStep, { step: 'idle' })
  const status = useSyncStatus()

  async function run(event: 'start' | 'retry'): Promise<void> {
    dispatch({ type: event })
    try {
      // A browser whose sync never connected (it was offline at boot) gets one chance to upload
      // before the outbox is judged.
      if (!syncStatus.get().connected) await startSync()
      const result = await wipeLocalIfSynced()
      dispatch({ type: 'wipe', result })
      if (result === 'pending') return
      await (await auth()).endSession()
      dispatch({ type: 'signed-out' })
      setNotice('signed-out')
    } catch {
      dispatch({ type: 'error' })
    }
  }

  const busy = state.step === 'saving' || state.step === 'signing-out'
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => void run('start')}
        data-testid="account-sign-out"
      >
        {busy ? m.acct_signout_saving() : m.acct_sign_out()}
      </Button>
      {state.step === 'pending' || state.step === 'failed' ? (
        <Dialog
          title={
            state.step === 'pending' ? m.acct_signout_pending_title() : m.acct_signout_failed()
          }
          onClose={() => dispatch({ type: 'cancel' })}
          testId="account-signout-pending"
          actions={
            <>
              <Button variant="primary" onClick={() => void run('retry')}>
                {m.acct_signout_retry()}
              </Button>
              <Button variant="quiet" onClick={() => dispatch({ type: 'cancel' })}>
                {m.acct_signout_stay()}
              </Button>
            </>
          }
        >
          {state.step === 'pending' ? (
            <p>{m.acct_signout_pending_body({ n: String(status?.pending ?? 0) })}</p>
          ) : null}
        </Dialog>
      ) : null}
    </>
  )
}

/* ---- Delete my data -------------------------------------------------------------------------- */

function DeleteData() {
  const [state, dispatch] = useReducer(deleteStep, { step: 'idle' })

  async function confirm(): Promise<void> {
    dispatch({ type: 'confirm' })
    try {
      const result = await (await auth()).deleteAccount()
      if (result !== 'deleted') {
        dispatch({ type: 'error' })
        return
      }
      dispatch({ type: 'deleted' })
      setNotice('deleted')
    } catch {
      dispatch({ type: 'error' })
    }
  }

  const open = state.step === 'asking' || state.step === 'deleting' || state.step === 'failed'
  const deleting = state.step === 'deleting'
  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        className="acct-inline acct-delete"
        onClick={() => dispatch({ type: 'ask' })}
        data-testid="account-delete"
      >
        {m.acct_delete()}
      </Button>
      {open ? (
        <Dialog
          title={m.acct_delete_title()}
          tone="danger"
          onClose={() => dispatch({ type: 'cancel' })}
          testId="account-delete-dialog"
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'cancel' })}
                disabled={deleting}
              >
                {m.acct_delete_cancel()}
              </Button>
              <Button
                variant="danger"
                onClick={() => void confirm()}
                disabled={deleting}
                aria-busy={deleting || undefined}
              >
                {deleting ? m.acct_deleting() : m.acct_delete_confirm()}
              </Button>
            </>
          }
        >
          <p>{m.acct_delete_body()}</p>
          {state.step === 'failed' ? (
            <p role="alert" className="acct-dialog__error">
              {m.acct_delete_failed()}
            </p>
          ) : null}
        </Dialog>
      ) : null}
    </>
  )
}
