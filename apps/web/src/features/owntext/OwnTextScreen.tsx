import { keyOf } from '@typing-race/curriculum'
import { Button } from '@typing-race/ui'
import { type ChangeEvent, type FormEvent, useId, useState } from 'react'
import { useDerived } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { type OwnText, rememberOwnText } from './model.js'
import { OwnTextRun } from './OwnTextRun.js'
import { decodeFile, judgeText, OWN_TEXT_MAX_CHARS } from './sanitize.js'

/**
 * Own text: the learner pastes a text or picks a `.txt`/`.md` file and types it as free practice,
 * on the same engine, guides and result screen as the real-text block, under its own id.
 */
export function OwnTextScreen() {
  const [own, setOwn] = useState<OwnText | null>(null)
  if (own !== null) return <OwnTextRun own={own} />
  return (
    <Form
      onStart={(next) => {
        rememberOwnText(next)
        setOwn(next)
      }}
    />
  )
}

function Form({ onStart }: { readonly onStart: (own: OwnText) => void }) {
  const { layout } = useDerived()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const textId = useId()
  const fileId = useId()
  const errorId = useId()

  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    const verdict = decodeFile(file.name, new Uint8Array(await file.arrayBuffer()))
    if (!verdict.ok) {
      setError(
        verdict.reason === 'type'
          ? m.map_own_error_type()
          : verdict.reason === 'size'
            ? m.map_own_error_size()
            : m.map_own_error_encoding(),
      )
      return
    }
    setError(null)
    setDraft(verdict.text)
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const verdict = judgeText(draft, (char) => keyOf(layout, char) !== undefined)
    if (!verdict.ok) {
      setError(
        verdict.reason === 'empty'
          ? m.map_own_error_empty()
          : m.map_own_error_chars({ chars: verdict.chars.join(' ') }),
      )
      return
    }
    setError(null)
    // A cut text is named on the pre-start card that replaces this form (`ownTextWording`).
    onStart({ text: verdict.text, cut: verdict.cut, layoutId: layout.id })
  }

  return (
    <section className="mx-auto max-w-2xl py-12">
      <h1 className="font-ui text-2xl font-bold">{m.map_own_title()}</h1>
      <p className="mt-2 font-ui text-ink-soft">{m.map_own_lead()}</p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
        <label htmlFor={textId} className="font-ui font-semibold">
          {m.map_own_text_label()}
        </label>
        <textarea
          id={textId}
          value={draft}
          rows={8}
          maxLength={OWN_TEXT_MAX_CHARS * 4}
          onChange={(event) => setDraft(event.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error === null ? undefined : errorId}
          className="w-full rounded-md border border-line bg-paper p-3 font-ui text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <label htmlFor={fileId} className="font-ui font-semibold">
          {m.map_own_file_label()}
        </label>
        <input
          id={fileId}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={(event) => void pick(event)}
          className="font-ui text-sm"
        />
        {error === null ? null : (
          <p id={errorId} role="alert" className="font-ui font-semibold text-red">
            {m.map_own_error_prefix()} {error}
          </p>
        )}
        <div>
          <Button type="submit" variant="primary" size="md">
            {m.map_own_start()}
          </Button>
        </div>
      </form>
    </section>
  )
}
