import { Link } from '@tanstack/react-router'
import { academyProgress } from '@typing-race/curriculum'
import { buttonClass } from '@typing-race/ui'
import { useMemo } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { useAcademyCourse } from './data.js'

/**
 * Stage 3 on the Path and on Today: its name, the course's module count and progress, and the way
 * in. Small on purpose; the Academy page is where the course is shown.
 */
export function AcademyStageLink() {
  const language = useAppStore((s) => s.settings.typingLanguage)
  const attempts = useAppStore((s) => s.attempts)
  const state = useAcademyCourse(language)
  const progress = useMemo(
    () => (state.status === 'ready' ? academyProgress(state.course, attempts) : null),
    [state, attempts],
  )

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3" data-testid="academy-stage">
      <div className="min-w-60 flex-1">
        <p className="font-ui font-semibold">{m.academy_stage_title()}</p>
        <p className="font-ui text-sm text-muted">
          {progress === null || state.status !== 'ready'
            ? m.academy_stage_note()
            : `${m.academy_stage_progress({
                complete: progress.modulesComplete,
                total: state.course.modules.length,
              })}. ${m.academy_stage_note()}`}
        </p>
      </div>
      <Link to="/academy" className={buttonClass('secondary', 'md')}>
        {m.academy_stage_open()}
      </Link>
    </div>
  )
}
