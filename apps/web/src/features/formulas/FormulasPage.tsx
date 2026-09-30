import { m } from '../../paraglide/messages.js'
import { Difficulty } from './Difficulty.js'
import { Progression } from './Progression.js'
import { Rhythm } from './Rhythm.js'
import { Speed } from './Speed.js'

const SECTIONS = [
  ['speed', () => m.formulas_speed_title()],
  ['difficulty', () => m.formulas_difficulty_title()],
  ['progression', () => m.formulas_progress_title()],
  ['rhythm', () => m.formulas_rhythm_title()],
] as const

/**
 * P3, the public Formulas page (User Story 4). It is a pure function of nothing: no store, no
 * progress, no props, so it renders for a visitor with no learner state at all — which is its
 * Independent Test.
 *
 * It renders its own `main` landmark; the shell must not wrap it in another one.
 */
export function FormulasPage() {
  return (
    <article className="mx-auto w-full max-w-4xl font-ui text-ink">
      <h1 className="mb-3 font-ui text-4xl font-semibold text-ink">{m.formulas_page_title()}</h1>
      <p className="max-w-[68ch] font-ui text-lg leading-relaxed text-ink">{m.formulas_lead()}</p>

      <nav aria-label={m.formulas_toc_label()} className="mt-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 font-ui text-base">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a className="text-sage underline underline-offset-4" href={`#${id}`}>
                {label()}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Speed />
      <Difficulty />
      <Progression />
      <Rhythm />
    </article>
  )
}
