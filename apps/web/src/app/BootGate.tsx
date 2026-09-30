import { Button, Card } from '@typing-race/ui'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { m } from '../paraglide/messages.js'
import { useAppStore } from './state/index.js'

/**
 * The four outcomes of reading local storage, each given a learner-facing path (FR-052, FR-083).
 *
 * The store returns them as values rather than throwing precisely so this component can exist: an
 * unreadable version and an unavailable browser are different situations with different remedies,
 * and collapsing them into one "something went wrong" would strand a learner in private browsing
 * who could otherwise practise perfectly well for the length of their visit.
 */
export function BootGate({ children }: { readonly children: ReactNode }) {
  const status = useAppStore((state) => state.status)
  const boot = useAppStore((state) => state.boot)
  const startFresh = useAppStore((state) => state.startFresh)

  useEffect(() => {
    void boot()
  }, [boot])

  if (status === 'loading') {
    return (
      <p role="status" className="py-16 text-center font-ui text-muted">
        {m.boot_loading()}
      </p>
    )
  }

  if (status === 'unreadable-version') {
    // FR-083: never read as if it were current, and never silently discarded either. The learner
    // chooses, and the wording says plainly that choosing deletes the old history.
    return (
      <Card className="mx-auto max-w-xl p-6" raised>
        <h1 className="font-ui text-xl font-bold">{m.boot_unreadable_title()}</h1>
        <p className="mt-3 font-ui leading-relaxed">{m.boot_unreadable_body()}</p>
        <Button variant="primary" className="mt-5" onClick={() => void startFresh()}>
          {m.boot_unreadable_action()}
        </Button>
      </Card>
    )
  }

  if (status === 'unavailable') {
    // FR-052: told plainly, and practice still runs. The app continues below the notice rather
    // than replacing itself with it.
    return (
      <>
        <Card className="mb-6 border-terracotta bg-terracotta-tint p-4">
          <h2 className="font-ui font-semibold">{m.boot_unavailable_title()}</h2>
          <p className="mt-1 font-ui text-sm leading-relaxed">{m.boot_unavailable_body()}</p>
        </Card>
        {children}
      </>
    )
  }

  return <>{children}</>
}
