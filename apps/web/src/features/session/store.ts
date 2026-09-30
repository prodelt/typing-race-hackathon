import { create } from 'zustand'
import { idleSession, reduceSession, type SessionAction, type SessionState } from './machine.js'

/**
 * The session's own state, held outside the app store because it is not progress: it is a plan for
 * the next half hour and may be thrown away at any moment. Module state behind Zustand, so it
 * survives navigating to the exercise screen and back, which unmounts the session screen.
 *
 * Deliberately not persisted: an interrupted session after a browser restart starts from the
 * intro again, which ends it deliberately and never strands the learner (FR-078). Every attempt
 * it produced is already in the progress store.
 */
interface SessionStore {
  readonly session: SessionState
  readonly dispatch: (action: SessionAction) => void
}

export const useSessionStore = create<SessionStore>()((set) => ({
  session: idleSession,
  dispatch(action) {
    set((store) => ({ session: reduceSession(store.session, action) }))
  },
}))
