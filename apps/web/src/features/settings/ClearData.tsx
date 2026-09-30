import { Button } from '@typing-race/ui'
import { useState } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'

/**
 * Clearing local data is irreversible, so it takes two steps: a button that only asks, and a second
 * that does it (FR-083: a fresh start is always the learner's choice). The confirm step is inline
 * rather than a modal, because a modal would need focus trapping that adds nothing here.
 */
export function ClearData() {
  const startFresh = useAppStore((state) => state.startFresh)
  const [step, setStep] = useState<'idle' | 'confirming' | 'done'>('idle')

  async function confirm(): Promise<void> {
    await startFresh()
    setStep('done')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-ui text-sm text-ink/80">{m.settings_data_body()}</p>
      {step === 'confirming' ? (
        <div role="alert" className="flex flex-col gap-3">
          <p className="font-ui font-semibold text-ink">{m.settings_data_confirm_title()}</p>
          <p className="font-ui text-sm text-ink/80">{m.settings_data_confirm_body()}</p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={() => void confirm()}>
              {m.settings_data_confirm_yes()}
            </Button>
            <Button variant="secondary" onClick={() => setStep('idle')}>
              {m.settings_data_cancel()}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setStep('confirming')}>
            {m.settings_data_clear()}
          </Button>
        </div>
      )}
      {step === 'done' && (
        <p role="status" className="font-ui text-sm font-semibold text-ink">
          {m.settings_data_done()}
        </p>
      )}
    </div>
  )
}
