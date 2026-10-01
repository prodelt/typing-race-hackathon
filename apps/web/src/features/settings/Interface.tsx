import type { Language } from '@typing-race/domain'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { setLocale } from '../../paraglide/runtime.js'
import { ChoiceGroup } from './Choice.js'

const LANGUAGE_NAME: Record<Language, () => string> = {
  uk: () => m.settings_lang_uk(),
  en: () => m.settings_lang_en(),
}

/**
 * T131. Interface language, independent of the typing language (FR-068). The sentence below the
 * control states both languages side by side, so Ukrainian typing with an English interface
 * reads as a deliberate combination rather than a mistake.
 *
 * The setting is persisted first and Paraglide's locale switched second. `setLocale` reloads the
 * document by default, which is the one way every already-rendered string is guaranteed to switch
 * (scenario 6); the reload must not race the write, so the write is awaited.
 */
export function Interface() {
  const interfaceLanguage = useAppStore((state) => state.settings.interfaceLanguage)
  const typingLanguage = useAppStore((state) => state.settings.typingLanguage)
  const changeSettings = useAppStore((state) => state.changeSettings)

  async function choose(language: Language): Promise<void> {
    await changeSettings({ interfaceLanguage: language })
    await setLocale(language)
  }

  return (
    <div className="set-stack">
      <ChoiceGroup<Language>
        legend={m.settings_ui_legend()}
        hint={m.settings_ui_hint()}
        value={interfaceLanguage}
        options={[
          { value: 'uk', label: m.settings_lang_uk() },
          { value: 'en', label: m.settings_lang_en() },
        ]}
        onChange={(value) => void choose(value)}
      />
      <p className="set-status">
        {m.settings_ui_current({
          interface: LANGUAGE_NAME[interfaceLanguage](),
          typing: LANGUAGE_NAME[typingLanguage](),
        })}
      </p>
    </div>
  )
}
