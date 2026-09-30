import { useNavigate } from '@tanstack/react-router'
import { Button } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { useSessionStore } from './store.js'

/**
 * T140. The session entry point for Today. It only navigates: composing the plan and stating the
 * expected length happen on the session screen, before the first block (FR-077). Any unlocked
 * exercise still starts on its own from Path (FR-079); nothing here is required to reach one.
 */
export function StartSession() {
  const navigate = useNavigate()
  const running = useSessionStore((store) => store.session.status === 'running')

  return (
    <Button variant="secondary" onClick={() => void navigate({ to: '/session' })}>
      {running ? m.session_resume_cta() : m.session_start_cta()}
    </Button>
  )
}
