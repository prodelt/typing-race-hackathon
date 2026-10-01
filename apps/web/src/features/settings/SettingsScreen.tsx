import { Panel, Screen, ScreenHead } from '../../app/Screen.js'
import { m } from '../../paraglide/messages.js'
import { ClearData } from './ClearData.js'
import { ErrorMode } from './ErrorMode.js'
import { Interface } from './Interface.js'
import { Language } from './Language.js'
import { Motion } from './Motion.js'
import { StartOver } from './StartOver.js'
import { TextSize } from './TextSize.js'
import { Theme } from './Theme.js'
import './settings.css'

/**
 * T125. Screen S2, reached from the cog in the status bar: the game's settings panel in direction
 * B — five panels in three columns, every control a native one. It changes settings and never
 * applies them: `changeSettings` persists through the store seam and `app/theme.ts` writes the
 * result onto `<html>`, so every control here is a thin view of the store (FR-049).
 */
export function SettingsScreen() {
  return (
    <Screen className="set scr--fill">
      <ScreenHead title={m.settings_title()} lead={m.settings_intro()} />
      <div className="set-grid">
        <div className="set-col">
          <Panel id="set-look" title={m.settings_group_look()}>
            <Theme />
            <TextSize />
          </Panel>
          <Panel id="set-data" title={m.settings_group_data()}>
            <ClearData />
          </Panel>
        </div>
        <div className="set-col">
          <Panel id="set-motion" title={m.settings_group_motion()}>
            <Motion />
          </Panel>
          <Panel id="set-language" title={m.settings_group_language()}>
            <Interface />
          </Panel>
          <Panel id="set-start" title={m.settings_group_start()}>
            <StartOver />
          </Panel>
        </div>
        <div className="set-col">
          <Panel id="set-typing" title={m.settings_group_typing()}>
            <ErrorMode />
            <Language />
          </Panel>
        </div>
      </div>
    </Screen>
  )
}
