import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'
import { ScreenHead } from '../screen.js'
import { ClearData } from './ClearData.js'
import { ErrorMode } from './ErrorMode.js'
import { Interface } from './Interface.js'
import { Language } from './Language.js'
import { Motion } from './Motion.js'
import { TextSize } from './TextSize.js'
import { Theme } from './Theme.js'
import './settings.css'

/**
 * One group of settings, laid out as the brand site's form steps: "(1) Look" set large on the
 * left and sticky, the controls on the right.
 */
function Step({
  n,
  title,
  children,
}: {
  readonly n: number
  readonly title: string
  readonly children: ReactNode
}) {
  const id = `settings-step-${n}`
  return (
    <section className="fstep" id={`step-${n}`} data-section={title} aria-labelledby={id}>
      <h2 id={id} className="fstep__h">
        <span className="fstep__n" aria-hidden="true">
          ({n})
        </span>
        <span>{title}</span>
      </h2>
      <div className="fstep__body">{children}</div>
    </section>
  )
}

/**
 * Settings. It changes settings and never applies them: `changeSettings` persists through the
 * store seam and `app/theme.ts` writes the result onto `<html>`, so every control here is a thin
 * view of the store.
 */
export function SettingsScreen() {
  return (
    <div className="screen">
      <ScreenHead
        n={5}
        label={m.nav_settings()}
        title={m.settings_title()}
        lede={m.settings_intro()}
        dot
      />
      <div className="fsteps settings">
        <Step n={1} title={m.settings_group_look()}>
          <Theme />
          <Motion />
          <TextSize />
        </Step>
        <Step n={2} title={m.settings_group_typing()}>
          <ErrorMode />
          <Language />
        </Step>
        <Step n={3} title={m.settings_group_language()}>
          <Interface />
        </Step>
        <Step n={4} title={m.settings_group_data()}>
          <ClearData />
        </Step>
      </div>
    </div>
  )
}
