import {
  levels,
  MASTERY_STREAK,
  STAGE1_ACCURACY_FLOOR,
  STAGE1_WINDOW,
} from '@typing-race/curriculum'
import { Chip } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { Block, Formula, P, Section } from './Formula.js'

const LEVEL_NAMES: Readonly<Record<string, () => string>> = {
  introduction: () => m.formulas_level_introduction(),
  basic: () => m.formulas_level_basic(),
  intermediate: () => m.formulas_level_intermediate(),
  advanced: () => m.formulas_level_advanced(),
  expert: () => m.formulas_level_expert(),
}

/** Whole percent, the way the requirements' table prints it. */
const percent = (fraction: number) => `${Math.round(fraction * 100)} %`

const CELL = 'px-4 py-2'

/**
 * The level table, straight from the curriculum data so the page cannot drift from the values in
 * force (FR-030), then the Mastery Rule, Stage 1 completion, and the statement that speed gates
 * nothing.
 */
export function Progression() {
  const floorPercent = Math.round(STAGE1_ACCURACY_FLOOR * 100)
  return (
    <Section id="progression" title={m.formulas_progress_title()}>
      <Block title={m.formulas_levels_title()}>
        <div className="overflow-hidden rounded-[var(--radius-card)] border-[length:var(--border-hairline)] border-hairline-strong">
          <table className="w-full border-collapse text-left font-ui text-base text-ink">
            <caption className="sr-only">{m.formulas_levels_caption()}</caption>
            <thead className="bg-sage-tint">
              <tr>
                <th scope="col" className={`${CELL} font-semibold`}>
                  {m.formulas_col_level()}
                </th>
                <th scope="col" className={`${CELL} font-semibold`}>
                  {m.formulas_col_speed()}
                </th>
                <th scope="col" className={`${CELL} font-semibold`}>
                  {m.formulas_col_floor()}
                </th>
                <th scope="col" className={`${CELL} font-semibold`}>
                  {m.formulas_col_status()}
                </th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => {
                const inForce = level.id === 'introduction'
                return (
                  <tr
                    key={level.id}
                    className="border-t-[length:var(--border-hairline)] border-hairline"
                  >
                    <th scope="row" className={`${CELL} font-semibold`}>
                      {LEVEL_NAMES[level.id]?.() ?? level.id}
                    </th>
                    <td className={`${CELL} font-mono text-[0.95rem]`}>
                      {level.spmBenchmark === null
                        ? m.formulas_speed_none()
                        : m.formulas_speed_range({
                            min: level.spmBenchmark.min,
                            max: level.spmBenchmark.max,
                          })}
                    </td>
                    <td className={`${CELL} font-mono text-[0.95rem]`}>
                      {percent(level.accuracyFloor)}
                    </td>
                    <td className={CELL}>
                      <Chip tone={inForce ? 'sage' : 'muted'}>
                        {inForce ? m.formulas_status_in_force() : m.formulas_status_informational()}
                      </Chip>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <P>{m.formulas_levels_note()}</P>
      </Block>

      <Block title={m.formulas_mastery_title()}>
        <Formula>{`mastered ⇔ last ${MASTERY_STREAK} test attempts all have accuracy ≥ floor`}</Formula>
        <P>{m.formulas_mastery_body()}</P>
      </Block>

      <Block title={m.formulas_stage1_title()}>
        <Formula>
          {`stage1Complete ⇔ every scale complete ∧ mean(accuracy of last ${STAGE1_WINDOW} attempts) ≥ ${STAGE1_ACCURACY_FLOOR}`}
        </Formula>
        <P>{m.formulas_stage1_body({ floor: floorPercent })}</P>
      </Block>

      <Block title={m.formulas_speed_gates_title()}>
        <P>{m.formulas_speed_gates_body()}</P>
      </Block>
    </Section>
  )
}
