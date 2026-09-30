import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'

/**
 * A formula as the code computes it. Formulas are kept language-neutral: identifiers and
 * operators, never translated prose, so a reader in either locale sees the same thing the code
 * does. Set on a blush block with a red rule down its left edge; the visually hidden label names
 * the block for a screen reader.
 */
export function Formula({ children }: { readonly children: ReactNode }) {
  return (
    <div className="formula">
      <span className="sr-only">{m.formulas_formula_label()}: </span>
      <code>{children}</code>
    </div>
  )
}

/**
 * One titled section of the page; the title is the `h2` its landmark is named by. Laid out as the
 * brand site's form steps: the title large on the left and sticky, the content on the right.
 */
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
    <section aria-labelledby={`${id}-title`} id={id} data-section={title} className="fsec">
      <h2 id={`${id}-title`} className="fsec__title">
        {title}
      </h2>
      <div className="fsec__body">{children}</div>
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
    <div className="fblock">
      <h3 className="fblock__title">
        {title}
        {aside}
      </h3>
      <div className="fblock__body">{children}</div>
    </div>
  )
}

export function P({ children }: { readonly children: ReactNode }) {
  return <p className="fp">{children}</p>
}
