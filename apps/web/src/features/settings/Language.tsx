import type { Language as LanguageId, LayoutId } from '@typing-race/domain'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { ChoiceGroup } from './Choice.js'

/**
 * T130. Typing language and layout. Changing the language moves the layout with it inside the
 * reducer, and progress is kept per language, so nothing here discards the other language's
 * progress (FR-051). The layout is read from the store afterwards, so the follow-on is visible.
 */
export function Language() {
  const typingLanguage = useAppStore((state) => state.settings.typingLanguage)
  const layoutId = useAppStore((state) => state.settings.layoutId)
  const changeSettings = useAppStore((state) => state.changeSettings)

  return (
    <div className="flex flex-col gap-10">
      <ChoiceGroup<LanguageId>
        legend={m.settings_typing_legend()}
        hint={m.settings_typing_hint()}
        value={typingLanguage}
        options={[
          { value: 'uk', label: m.settings_lang_uk() },
          { value: 'en', label: m.settings_lang_en() },
        ]}
        onChange={(value) => void changeSettings({ typingLanguage: value })}
      />
      <ChoiceGroup<LayoutId>
        legend={m.settings_layout_legend()}
        hint={m.settings_layout_hint()}
        value={layoutId}
        options={[
          { value: 'yq', label: m.settings_layout_yq() },
          { value: 'qwerty', label: m.settings_layout_qwerty() },
        ]}
        onChange={(value) => void changeSettings({ layoutId: value })}
      />
    </div>
  )
}
