import { Chip, IconKeyboard, IconNextAction, IconUnlock, IconZeroPeek } from '@typing-race/ui'
import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'
import { Reveal } from './Reveal.js'
import { TypingSpecimen } from './TypingSpecimen.js'
import './product.css'

export interface ProductPageProps {
  /** Where "Start practising" leads. The router owns the real route; this is only a default. */
  readonly practiceHref?: string
  /** Where the Formulas page lives. */
  readonly formulasHref?: string
}

const CTA_BASE =
  'inline-flex items-center justify-center rounded-[var(--radius-field)] border-[length:var(--border-hairline)] font-ui font-semibold h-12 px-6 text-base ease-[var(--ease-standard)] duration-[var(--dur-base)] transition-[background-color,filter,transform] active:translate-y-px'

interface Stage {
  readonly n: number
  readonly title: string
  readonly body: string
  readonly available: boolean
}

interface Principle {
  readonly icon: ReactNode
  readonly title: string
  readonly body: string
}

/**
 * P0, the product page. The one screen before sign-in, so it reads nothing about the learner.
 *
 * **Its visual asset is the product itself.** A typing trainer's landing page does not need stock
 * photography of hands on a keyboard; it needs to demonstrate the one thing that makes this
 * trainer different, and the fastest way to say "a corrected error still counts" is to show a line
 * being typed, a wrong key being marked in place, a Backspace, and a counter that does not fall.
 * That is FR-016, FR-017 and FR-024 argued in eight seconds without a word of copy.
 *
 * Four sections, four different layout families, because a page where every section is three equal
 * cards reads as a template no matter how good the typography is: an asymmetric split hero, a
 * stepped stage ladder that is deliberately unequal, a two-column editorial list ruled with
 * hairlines rather than boxed in cards, and a full-width band.
 */
export function ProductPage({
  practiceHref = '/path',
  formulasHref = '/formulas',
}: ProductPageProps) {
  const stages: readonly Stage[] = [
    { n: 1, title: m.product_stage1_title(), body: m.product_stage1_body(), available: true },
    { n: 2, title: m.product_stage2_title(), body: m.product_stage2_body(), available: false },
    { n: 3, title: m.product_stage3_title(), body: m.product_stage3_body(), available: false },
  ]
  const principles: readonly Principle[] = [
    {
      icon: <IconZeroPeek size={22} />,
      title: m.product_p_blind_title(),
      body: m.product_p_blind_body(),
    },
    {
      icon: <IconUnlock size={22} />,
      title: m.product_p_speed_title(),
      body: m.product_p_speed_body(),
    },
    {
      icon: <IconKeyboard size={22} />,
      title: m.product_p_errors_title(),
      body: m.product_p_errors_body(),
    },
    {
      icon: <IconNextAction size={22} />,
      title: m.product_p_next_title(),
      body: m.product_p_next_body(),
    },
  ]

  return (
    <article className="product mx-auto w-full max-w-6xl font-ui text-ink">
      {/* ---- Hero: asymmetric split, text left, the live product right ------------------ */}
      <section
        aria-labelledby="product-title"
        className="grid items-center gap-10 pt-6 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14"
      >
        <div className="product__enter">
          <p className="mb-4 font-mono text-xs tracking-[0.18em] text-sage uppercase">
            {m.product_eyebrow()}
          </p>
          <h1
            id="product-title"
            className="max-w-[19ch] font-ui text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.08] font-bold tracking-tight text-balance"
          >
            {m.product_h1()}
          </h1>
          <p className="mt-5 max-w-[44ch] font-ui text-[1.0625rem] leading-relaxed text-ink/75">
            {m.product_lead()}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              className={`${CTA_BASE} border-sage bg-sage text-paper hover:brightness-110`}
              href={practiceHref}
            >
              {m.product_cta_start()}
            </a>
            <a
              className={`${CTA_BASE} border-hairline-strong bg-paper-raised hover:bg-sage-tint`}
              href={formulasHref}
            >
              {m.product_cta_formulas()}
            </a>
          </div>
        </div>

        <div className="product__enter product__enter--late">
          <TypingSpecimen />
        </div>
      </section>

      {/* ---- Stages: a ladder, deliberately unequal --------------------------------------
          Three equal cards would say the three stages are equally real. They are not: only
          Stage 1 ships today, and a layout that admits it is both more honest and better
          looking than one that pretends otherwise. */}
      <Reveal
        as="section"
        aria-labelledby="product-stages"
        className="border-t border-hairline py-16"
      >
        <h2 id="product-stages" className="font-ui text-3xl font-bold tracking-tight">
          {m.product_stages_title()}
        </h2>
        <ol className="mt-8 grid list-none gap-px overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-hairline p-0 md:grid-cols-[1.3fr_1fr_1fr]">
          {stages.map((stage) => (
            <li
              key={stage.n}
              data-available={stage.available}
              className="product__stage bg-paper-raised p-6"
            >
              <div className="flex items-center gap-2">
                <span className="product__stage-n font-mono text-sm">
                  {m.product_stage_label({ n: String(stage.n) })}
                </span>
                <Chip tone={stage.available ? 'sage' : 'muted'}>
                  {stage.available ? m.product_stage_now() : m.product_stage_later()}
                </Chip>
              </div>
              <h3 className="mt-4 font-ui text-xl leading-snug font-semibold text-balance">
                {stage.title}
              </h3>
              <p className="mt-3 font-ui text-sm leading-relaxed text-ink/70">{stage.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      {/* ---- Principles: an editorial list ruled with hairlines, not four boxes ---------- */}
      <Reveal
        as="section"
        aria-labelledby="product-principles"
        className="border-t border-hairline py-16"
      >
        <h2 id="product-principles" className="font-ui text-3xl font-bold tracking-tight">
          {m.product_principles_title()}
        </h2>
        <dl className="mt-8 grid gap-x-14 gap-y-9 md:grid-cols-2">
          {principles.map((principle) => (
            <div key={principle.title} className="product__principle">
              <dt className="flex items-center gap-2.5 font-ui text-lg font-semibold">
                <span className="text-sage">{principle.icon}</span>
                {principle.title}
              </dt>
              <dd className="mt-2 ml-0 font-ui text-[0.95rem] leading-relaxed text-ink/70">
                {principle.body}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>

      {/* ---- Formulas: a full-width band, the fourth layout family ----------------------- */}
      <Reveal
        as="section"
        aria-labelledby="product-audit"
        className="my-16 rounded-[var(--radius-card)] bg-sage-tint px-8 py-12 md:px-12"
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              id="product-audit"
              className="max-w-[18ch] font-ui text-3xl leading-tight font-bold tracking-tight text-balance"
            >
              {m.product_audit_title()}
            </h2>
            <p className="mt-4 max-w-[52ch] font-ui leading-relaxed text-ink/75">
              {m.product_audit_body()}
            </p>
          </div>
          <a
            className={`${CTA_BASE} shrink-0 border-sage-ink bg-transparent text-sage-ink hover:bg-paper-raised`}
            href={formulasHref}
          >
            {m.product_audit_link()}
          </a>
        </div>
      </Reveal>
    </article>
  )
}
