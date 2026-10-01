import { m } from '../../paraglide/messages.js'
import { RefPage } from '../public/RefPage.js'
import { Difficulty } from './Difficulty.js'
import { Progression } from './Progression.js'
import { Rhythm } from './Rhythm.js'
import { Speed } from './Speed.js'

/**
 * P3, the public Formulas page (User Story 4). It is a pure function of nothing: no store, no
 * progress, no props, so it renders for a visitor with no learner state at all — which is its
 * Independent Test. It is a reference page of the «Про гру» menu, so it takes `RefPage`'s reading
 * layout, its sections listed in the side panel.
 */
export function FormulasPage() {
  return (
    <RefPage
      title={m.formulas_page_title()}
      lead={m.formulas_lead()}
      current="/formulas"
      tocLabel={m.formulas_toc_label()}
      toc={[
        { id: 'speed', label: m.formulas_speed_title() },
        { id: 'difficulty', label: m.formulas_difficulty_title() },
        { id: 'progression', label: m.formulas_progress_title() },
        { id: 'rhythm', label: m.formulas_rhythm_title() },
      ]}
    >
      <Speed />
      <Difficulty />
      <Progression />
      <Rhythm />
    </RefPage>
  )
}
