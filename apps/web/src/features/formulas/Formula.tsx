import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'

/**
 * A formula as the code computes it. Formulas are set in the mono face and kept language-neutral:
 * identifiers and operators, never translated prose, so a reader in either locale sees the same
 * thing the code does. The visually hidden label names the block for a screen reader.
 */
export function Formula({ children }: { readonly children: ReactNode }) {
  return (
    <div className="ref-formula">
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
    <section aria-labelledby={`${id}-title`} id={id} className="ref-section">
      <h2 id={`${id}-title`} className="ref-h2">
        {title}
      </h2>
      <div className="ref-stack">{children}</div>
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
      <h3 className="ref-h3">
        {title}
        {aside}
      </h3>
      <div className="ref-stack ref-stack--tight">{children}</div>
    </div>
  )
}

export function P({ children }: { readonly children: ReactNode }) {
  return <p className="ref-p">{children}</p>
}
