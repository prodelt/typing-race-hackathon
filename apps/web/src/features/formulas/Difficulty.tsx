import { m } from '../../paraglide/messages.js'
import { Block, Formula, P, Section } from './Formula.js'

/**
 * The row-change measure, both readings. Ticket 08 found that the requirements' example
 * (`rowChanges: 3` for «навчання») reproduces only as distinct rows touched; adjacent pairs give 5.
 * The code — `rowChange` on each `Transition` — counts adjacent pairs, so that is what we state.
 */
export function Difficulty() {
  return (
    <Section id="difficulty" title={m.formulas_difficulty_title()}>
      <P>{m.formulas_difficulty_intro()}</P>

      <Block title={m.formulas_rowa_title()}>
        <Formula>{'rowChanges = #{ i : row(letter[i]) ≠ row(letter[i+1]) }'}</Formula>
        <P>{m.formulas_rowa_body()}</P>
      </Block>

      <Block title={m.formulas_rowb_title()}>
        <Formula>{'rowsTouched = | { row(letter[i]) } |'}</Formula>
        <P>{m.formulas_rowb_body()}</P>
      </Block>

      <Block title={m.formulas_row_example_title()}>
        <P>{m.formulas_row_example_rows()}</P>
        <ul className="ref-list">
          <li>{m.formulas_row_example_a()}</li>
          <li>{m.formulas_row_example_b()}</li>
        </ul>
      </Block>

      <Block title={m.formulas_row_counted_title()}>
        <P>{m.formulas_row_counted_body()}</P>
        <P>{m.formulas_row_why()}</P>
        <P>{m.formulas_row_ambiguity()}</P>
      </Block>

      <Block title={m.formulas_same_finger_title()}>
        <P>{m.formulas_same_finger_body()}</P>
      </Block>
    </Section>
  )
}
