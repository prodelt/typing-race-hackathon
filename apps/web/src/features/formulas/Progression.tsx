import {
  academyLevel,
  introductionLevel,
  levels,
  MASTERY_STREAK,
  STAGE1_ACCURACY_FLOOR,
  STAGE1_WINDOW,
} from '@typing-race/curriculum'
import type { Level } from '@typing-race/domain'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { Block, Formula, P, Section } from './Formula.js'

/** The interface language the level config's names and goals are read in. */
const language = () => (getLocale() === 'en' ? 'en' : 'uk')

/** "без вимог", "100–150 SPM" or "300+ SPM", from the config's benchmark. */
function speedCell(benchmark: Level['spmBenchmark']): string {
  if (benchmark === null) return m.formulas_speed_none()
  if (benchmark.max === null) return m.formulas_speed_open({ min: benchmark.min })
  return m.formulas_speed_range({ min: benchmark.min, max: benchmark.max })
}

/** Whole percent, the way the requirements' table prints it. */
const percent = (fraction: number) => `${Math.round(fraction * 100)} %`

/**
 * The level table, rendered from the curriculum's one level config (`levels.json`) — names, goals,
 * benchmarks and floors alike — so the page cannot drift from the values in force, then the Mastery Rule, Stage 1 completion, and the statement that speed gates
 * nothing.
 */
export function Progression() {
  const floorPercent = Math.round(STAGE1_ACCURACY_FLOOR * 100)
  return (
    <Section id="progression" title={m.formulas_progress_title()}>
      <Block title={m.formulas_levels_title()}>
        <div className="ref-table-wrap">
          <table className="ref-table">
            <caption className="sr-only">{m.formulas_levels_caption()}</caption>
            <thead>
              <tr>
                <th scope="col">{m.formulas_col_level()}</th>
                <th scope="col">{m.formulas_col_speed()}</th>
                <th scope="col">{m.formulas_col_floor()}</th>
                <th scope="col">{m.formulas_col_goal()}</th>
                <th scope="col">{m.formulas_col_status()}</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => {
                const inForce = level.id === introductionLevel.id
                const inAcademy = level.id === academyLevel.id
                return (
                  <tr key={level.id}>
                    <th scope="row">{level.name[language()]}</th>
                    <td className="ref-table__mono">{speedCell(level.spmBenchmark)}</td>
                    <td className="ref-table__mono">{percent(level.accuracyFloor)}</td>
                    <td>{level.goal[language()]}</td>
                    <td>
                      <span className={inForce || inAcademy ? 'scr-tag scr-tag--ink' : 'scr-tag'}>
                        {inForce
                          ? m.formulas_status_in_force()
                          : inAcademy
                            ? m.formulas_status_academy()
                            : m.formulas_status_informational()}
                      </span>
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
