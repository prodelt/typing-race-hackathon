import { Link } from '@tanstack/react-router'
import { buttonClass } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'

/**
 * "Start over": the first run again — language, level, finger scheme — ending on an exercise.
 * It deletes nothing; the level it records is forward only, and the only way to erase history
 * stays the separate, two-step "clear data" (FR-083).
 */
export function StartOver() {
  return (
    <div className="set-stack">
      <p className="set-hint">{m.settings_start_over_body()}</p>
      <div>
        <Link to="/start" className={buttonClass('secondary', 'sm')}>
          {m.settings_start_over()}
        </Link>
      </div>
    </div>
  )
}
