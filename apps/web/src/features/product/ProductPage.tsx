import { Card, Chip, IconKeyboard, IconNextAction, IconUnlock, IconZeroPeek } from '@typing-race/ui'
import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'

export interface ProductPageProps {
  /** Where "Start practising" leads. The router owns the real route; this is only a default. */
  readonly practiceHref?: string
  /** Where the Formulas page lives. */
  readonly formulasHref?: string
}

const LINK_BASE =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-field)] border-[length:var(--border-hairline)] font-ui font-semibold h-12 px-6 text-base ease-[var(--ease-standard)] duration-[var(--dur-base)] transition-[background-color,filter]'

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
 * P0, the product page: what the app is, the three stages, and the way into practice. It is the
 * one screen before sign-in, so it reads nothing about the learner and takes only two links.
 *
 * It renders its own `main` landmark; the shell must not wrap it in another one.
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
      icon: <IconZeroPeek size={24} />,
      title: m.product_p_blind_title(),
      body: m.product_p_blind_body(),
    },
    {
      icon: <IconUnlock size={24} />,
      title: m.product_p_speed_title(),
      body: m.product_p_speed_body(),
    },
    {
      icon: <IconKeyboard size={24} />,
      title: m.product_p_errors_title(),
      body: m.product_p_errors_body(),
    },
    {
      icon: <IconNextAction size={24} />,
      title: m.product_p_next_title(),
      body: m.product_p_next_body(),
    },
  ]

  return (
    <article className="mx-auto w-full max-w-5xl font-ui text-ink">
      <section aria-labelledby="product-title" className="pb-12">
        <p className="mb-3 font-mono text-sm tracking-tight text-sage">{m.product_eyebrow()}</p>
        <h1
          id="product-title"
          className="max-w-[20ch] font-ui text-5xl leading-tight font-semibold text-ink"
        >
          {m.product_h1()}
        </h1>
        <p className="mt-5 max-w-[60ch] font-ui text-lg leading-relaxed text-ink">
          {m.product_lead()}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            className={`${LINK_BASE} border-sage bg-sage text-paper hover:brightness-110`}
            href={practiceHref}
          >
            {m.product_cta_start()}
          </a>
          <a
            className={`${LINK_BASE} border-hairline-strong bg-paper-raised text-ink hover:bg-sage-tint`}
            href={formulasHref}
          >
            {m.product_cta_formulas()}
          </a>
          <Chip>{m.product_layouts()}</Chip>
        </div>
      </section>

      <section aria-labelledby="product-stages" className="py-10">
        <h2 id="product-stages" className="mb-6 font-ui text-3xl font-semibold text-ink">
          {m.product_stages_title()}
        </h2>
        <ol className="grid list-none gap-5 p-0 md:grid-cols-3">
          {stages.map((stage) => (
            <li key={stage.n} className="flex">
              <Card className="flex w-full flex-col gap-3 p-6" raised={stage.available}>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={stage.available ? 'sage' : 'muted'}>
                    {m.product_stage_label({ n: stage.n })}
                  </Chip>
                  <span className="font-mono text-xs text-ink">
                    {stage.available ? m.product_stage_available() : m.product_stage_planned()}
                  </span>
                </div>
                <h3 className="font-ui text-xl font-semibold text-ink">{stage.title}</h3>
                <p className="font-ui text-base leading-relaxed text-ink">{stage.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="product-principles" className="py-10">
        <h2 id="product-principles" className="mb-6 font-ui text-3xl font-semibold text-ink">
          {m.product_principles_title()}
        </h2>
        <ul className="grid list-none gap-x-8 gap-y-6 p-0 md:grid-cols-2">
          {principles.map((principle) => (
            <li key={principle.title} className="flex gap-4">
              <span className="mt-1 text-sage">{principle.icon}</span>
              <div>
                <h3 className="font-ui text-lg font-semibold text-ink">{principle.title}</h3>
                <p className="mt-1 max-w-[52ch] font-ui text-base leading-relaxed text-ink">
                  {principle.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="product-open" className="py-10">
        <Card raised className="flex flex-col gap-3 p-8">
          <h2 id="product-open" className="font-ui text-2xl font-semibold text-ink">
            {m.product_open_title()}
          </h2>
          <p className="max-w-[60ch] font-ui text-base leading-relaxed text-ink">
            {m.product_open_body()}
          </p>
          <p>
            <a
              className="font-ui font-semibold text-sage underline underline-offset-4"
              href={formulasHref}
            >
              {m.product_open_link()}
            </a>
          </p>
        </Card>
      </section>
    </article>
  )
}
