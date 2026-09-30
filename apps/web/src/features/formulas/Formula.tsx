import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'

/**
 * A formula as the code computes it. Formulas are set in the mono face and kept language-neutral:
 * identifiers and operators, never translated prose, so a reader in either locale sees the same
 * thing the code does. The visually hidden label names the block for a screen reader.
 */
export function Formula({ children }: { readonly children: ReactNode }) {
  return (
    <div className="my-3 rounded-[var(--radius-field)] border-[length:var(--border-hairline)] border-hairline-strong bg-paper px-4 py-3 font-mono text-[0.95rem] leading-relaxed break-words whitespace-pre-wrap text-ink">
      <span className="sr-only">{m.formulas_formula_label()}: </span>
      <code>{children}</code>
    </div>
  )
}

/** One titled section of the page; the title is the `h2` its landmark is named by. */
export function Section({
  id,
  title,
  children,
}: {
  readonly id: string
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="scroll-mt-8 py-8">
      <h2 id={`${id}-title`} className="mb-4 font-ui text-2xl font-semibold text-ink">
        {title}
      </h2>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

/** A sub-block under a section title: an `h3` and its content. */
export function Block({
  title,
  aside,
  children,
}: {
  readonly title: string
  readonly aside?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div>
      <h3 className="mb-2 flex flex-wrap items-center gap-3 font-ui text-lg font-semibold text-ink">
        {title}
        {aside}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export function P({ children }: { readonly children: ReactNode }) {
  return <p className="max-w-[68ch] font-ui text-base leading-relaxed text-ink">{children}</p>
}
