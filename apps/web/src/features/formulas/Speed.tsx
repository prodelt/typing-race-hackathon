import { Chip } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { Block, Formula, P, Section } from './Formula.js'

/** Speed, accuracy and errors — the numbers on every result screen. */
export function Speed() {
  return (
    <Section id="speed" title={m.formulas_speed_title()}>
      <P>{m.formulas_speed_intro()}</P>

      <Block title={m.formulas_spm_title()}>
        <Formula>{'SPM = characterKeystrokes × 60 000 ÷ elapsedMs'}</Formula>
        <P>{m.formulas_spm_body()}</P>
      </Block>

      <Block
        title={m.formulas_wpm_title()}
        aside={<Chip tone="muted">{m.formulas_secondary()}</Chip>}
      >
        <Formula>{'WPM = SPM / 5'}</Formula>
        <P>{m.formulas_wpm_body()}</P>
      </Block>

      <Block title={m.formulas_accuracy_title()}>
        <Formula>{'accuracy = correctCharKeystrokes ÷ allCharKeystrokes'}</Formula>
        <P>{m.formulas_accuracy_body()}</P>
        <P>{m.formulas_accuracy_corrected()}</P>
        <P>{m.formulas_accuracy_backspace()}</P>
        <P>{m.formulas_accuracy_empty()}</P>
      </Block>

      <Block title={m.formulas_errors_title()}>
        <Formula>{'errorCount = allCharKeystrokes − correctCharKeystrokes'}</Formula>
        <P>{m.formulas_errors_body()}</P>
      </Block>
    </Section>
  )
}
