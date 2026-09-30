import { useId } from 'react'
import { useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'

/** FR-063: at least 40 px, no less than 24 px. */
export const MIN_TEXT_SIZE = 24
export const MAX_TEXT_SIZE = 40

/**
 * T128. The slider's label is a real `<label>` tied by id, and `aria-valuetext` gives the value
 * with its unit; a range input with only a visual caption is the usual axe failure.
 *
 * The preview is set in `--font-typing` at the chosen size, in the typing language rather than
 * the interface one, because that is the text the learner will actually see in the typing line.
 */
export function TextSize() {
  const textSizePx = useAppStore((state) => state.settings.textSizePx)
  const typingLanguage = useAppStore((state) => state.settings.typingLanguage)
  const changeSettings = useAppStore((state) => state.changeSettings)
  const id = useId()
  const hintId = `${id}-hint`
  const valueText = m.settings_size_value({ px: textSizePx })

  return (
    <div className="setting">
      <div className="size__head">
        <label htmlFor={id} className="setting__label">
          {m.settings_size_label()}
        </label>
        <output htmlFor={id} className="size__value">
          {valueText}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_TEXT_SIZE}
        max={MAX_TEXT_SIZE}
        step={1}
        value={textSizePx}
        aria-valuetext={valueText}
        aria-describedby={hintId}
        onChange={(event) => void changeSettings({ textSizePx: Number(event.target.value) })}
        className="size__range"
      />
      <p id={hintId} className="setting__hint">
        {m.settings_size_hint()}
      </p>
      <div className="size__preview">
        <p className="size__preview-label">{m.settings_size_preview_label()}</p>
        <p
          data-testid="text-size-preview"
          lang={typingLanguage}
          style={{ fontSize: `${textSizePx}px` }}
          className="size__preview-text"
        >
          {m.settings_size_preview_text({}, { locale: typingLanguage })}
        </p>
      </div>
    </div>
  )
}
