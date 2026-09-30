import type { MotionSetting } from '@typing-race/domain'
import { useId } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { ChoiceGroup } from './Choice.js'

/**
 * T127. Motion and sound together, because FR-064 makes them one switch: a learner who turns
 * motion off and still hears a chime has not been listened to. The consequence is said in words
 * and the sound control is disabled rather than hidden, so the learner sees why it is unavailable.
 *
 * Sound is off by default (scenario 3), and `allowsSound` in `@typing-race/ui` is what finally
 * gates playback; this control only records the wish.
 */
export function Motion() {
  const motion = useAppStore((state) => state.settings.motion)
  const sound = useAppStore((state) => state.settings.sound)
  const changeSettings = useAppStore((state) => state.changeSettings)
  const soundId = useId()
  const soundHintId = `${soundId}-hint`
  const blocked = motion === 'off'

  return (
    <div className="flex flex-col gap-4">
      <ChoiceGroup<MotionSetting>
        legend={m.settings_motion_legend()}
        hint={m.settings_motion_hint()}
        value={motion}
        options={[
          { value: 'system', label: m.settings_motion_system() },
          { value: 'reduced', label: m.settings_motion_reduced() },
          { value: 'off', label: m.settings_motion_off() },
        ]}
        onChange={(value) => void changeSettings({ motion: value })}
      />
      {blocked && (
        <p role="status" className="font-ui text-sm font-semibold text-ink">
          {m.settings_motion_off_consequence()}
        </p>
      )}
      <div className="flex items-start gap-3">
        <input
          id={soundId}
          type="checkbox"
          checked={sound === 'on' && !blocked}
          disabled={blocked}
          aria-describedby={soundHintId}
          onChange={(event) => void changeSettings({ sound: event.target.checked ? 'on' : 'off' })}
          className="mt-1 size-4 accent-[var(--color-sage)]"
        />
        <div className="flex flex-col gap-0.5">
          <label htmlFor={soundId} className="font-ui font-semibold text-ink">
            {m.settings_sound_label()}
          </label>
          <p id={soundHintId} className="font-ui text-sm text-ink/80">
            {blocked ? m.settings_sound_blocked() : m.settings_sound_hint()}
          </p>
        </div>
      </div>
    </div>
  )
}
