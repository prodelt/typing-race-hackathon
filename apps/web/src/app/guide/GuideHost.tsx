import { lazy, Suspense, useEffect } from 'react'
import { usePlayMode } from '../playMode.js'
import { closeGuide, useGuide } from './model.js'

const CoachMarks = lazy(() => import('./CoachMarks.js'))

/** Mounts the lazy coach-marks while a guide is open, and never during a run. */
export function GuideHost() {
  const screen = useGuide((state) => state.screen)
  const open = useGuide((state) => state.open)
  const play = usePlayMode()
  useEffect(() => {
    if (play && useGuide.getState().open) useGuide.setState({ open: false })
  }, [play])
  if (!open || play || screen === null) return null
  return (
    <Suspense fallback={null}>
      <CoachMarks key={screen} screen={screen} onClose={closeGuide} />
    </Suspense>
  )
}
