import type { ThemeSetting } from '@typing-race/domain'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import { ChoiceGroup } from './Choice.js'

/**
 * T126. Four choices for one setting. The low-vision preset is a value of `theme`, not a size
 * multiplier on the light one (FR-062): `themes.css` carries a full third palette for it, and this
 * control only names it.
 */
export function Theme() {
  const theme = useAppStore((state) => state.settings.theme)
  const changeSettings = useAppStore((state) => state.changeSettings)

  return (
    <ChoiceGroup<ThemeSetting>
      legend={m.settings_theme_legend()}
      hint={m.settings_theme_hint()}
      value={theme}
      options={[
        { value: 'system', label: m.settings_theme_system() },
        { value: 'light', label: m.settings_theme_light() },
        { value: 'dark', label: m.settings_theme_dark() },
        {
          value: 'lowVision',
          label: m.settings_theme_lowVision(),
          hint: m.settings_theme_lowVision_hint(),
        },
      ]}
      onChange={(value) => void changeSettings({ theme: value })}
    />
  )
}
