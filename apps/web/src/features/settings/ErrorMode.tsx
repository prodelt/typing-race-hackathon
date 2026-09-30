import type { ErrorMode as ErrorModeSetting } from '@typing-race/domain'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { ChoiceGroup } from './Choice.js'

/**
 * T129. Stop-on-letter is the stage-one default (ticket 10). Either mode keeps FR-024: a wrong
 * keystroke counts even when corrected, which the hint says so the learner is not surprised.
 */
export function ErrorMode() {
  const errorMode = useAppStore((state) => state.settings.errorMode)
  const changeSettings = useAppStore((state) => state.changeSettings)

  return (
    <ChoiceGroup<ErrorModeSetting>
      legend={m.settings_errors_legend()}
      hint={m.settings_errors_hint()}
      value={errorMode}
      options={[
        {
          value: 'stopOnLetter',
          label: m.settings_errors_stopOnLetter(),
          hint: m.settings_errors_stopOnLetter_hint(),
        },
        {
          value: 'freeBackspace',
          label: m.settings_errors_freeBackspace(),
          hint: m.settings_errors_freeBackspace_hint(),
        },
      ]}
      onChange={(value) => void changeSettings({ errorMode: value })}
    />
  )
}
