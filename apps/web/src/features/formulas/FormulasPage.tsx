import { m } from '../../paraglide/messages.js'
import { ScreenHead } from '../screen.js'
import { Difficulty } from './Difficulty.js'
import { Progression } from './Progression.js'
import { Rhythm } from './Rhythm.js'
import { Speed } from './Speed.js'
import './formulas.css'

const SECTIONS = [
  ['speed', () => m.formulas_speed_title()],
  ['difficulty', () => m.formulas_difficulty_title()],
  ['progression', () => m.formulas_progress_title()],
  ['rhythm', () => m.formulas_rhythm_title()],
] as const

/**
 * The public Formulas page. It is a pure function of nothing: no store, no progress, no props, so
 * it renders for a visitor with no learner state at all.
 *
 * The head carries a numbered contents list, `[01] Speed and accuracy`, the way the brand site
 * numbers its sections; each section then sets its title large and sticky beside its formulas.
 */
export function FormulasPage() {
  return (
    <article className="screen formulas">
      <ScreenHead
        n={6}
        label={m.footer_formulas()}
        title={m.formulas_page_title()}
        lede={m.formulas_lead()}
        dot
      >
        <nav aria-label={m.formulas_toc_label()} className="ftoc">
          <ol>
            {SECTIONS.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`}>
                  <span className="ftoc__n" aria-hidden="true">
                    [{String(i + 1).padStart(2, '0')}]
                  </span>
                  {label()}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </ScreenHead>

      <Speed />
      <Difficulty />
      <Progression />
      <Rhythm />
    </article>
  )
}
