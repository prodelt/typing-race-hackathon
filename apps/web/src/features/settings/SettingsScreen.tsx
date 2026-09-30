import { Card } from '@typing-race/ui'
import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'
import { ClearData } from './ClearData.js'
import { ErrorMode } from './ErrorMode.js'
import { Interface } from './Interface.js'
import { Language } from './Language.js'
import { Motion } from './Motion.js'
import { TextSize } from './TextSize.js'
import { Theme } from './Theme.js'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-6 p-6">
      <h2 className="font-ui text-lg font-bold text-ink">{title}</h2>
      {children}
    </Card>
  )
}

/**
 * T125. Screen S2. It changes settings and never applies them: `changeSettings` persists through
 * the store seam and `app/theme.ts` writes the result onto `<html>`, so every control here is a
 * thin view of the store (FR-049).
 */
export function SettingsScreen() {
  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-ui text-2xl font-bold text-ink">{m.settings_title()}</h1>
        <p className="font-ui text-ink/80">{m.settings_intro()}</p>
      </header>
      <Section title={m.settings_group_look()}>
        <Theme />
        <Motion />
        <TextSize />
      </Section>
      <Section title={m.settings_group_typing()}>
        <ErrorMode />
        <Language />
      </Section>
      <Section title={m.settings_group_language()}>
        <Interface />
      </Section>
      <Section title={m.settings_group_data()}>
        <ClearData />
      </Section>
    </section>
  )
}
