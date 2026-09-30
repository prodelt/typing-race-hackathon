import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Settings } from '@typing-race/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialState, setProgressStore, useAppStore } from '../../app/state/index.js'
import { m } from '../../paraglide/messages.js'
import * as runtime from '../../paraglide/runtime.js'
import { memoryStore } from '../../seams/index.js'
import { SettingsScreen } from './SettingsScreen.js'

vi.mock('../../paraglide/runtime.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../paraglide/runtime.js')>()),
  setLocale: vi.fn(),
}))

/**
 * Wraps the real `changeSettings` in a spy, so a test sees the exact patch a control sends while
 * the store still applies it: that is what proves the control reflects the store and not local state.
 */
function spyOnChange() {
  const original = useAppStore.getState().changeSettings
  const spy = vi.fn(original)
  useAppStore.setState({ changeSettings: spy })
  return spy
}

function settings(): Settings {
  return useAppStore.getState().settings
}

beforeEach(() => {
  setProgressStore(memoryStore())
  useAppStore.setState({ ...initialState, status: 'ready' })
})

describe('SettingsScreen', () => {
  it('offers system, light, dark and low-vision, with light the default and checked', () => {
    render(<SettingsScreen />)
    const group = screen.getByRole('group', { name: m.settings_theme_legend() })
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(4)
    expect(screen.getByRole('radio', { name: m.settings_theme_light() })).toBeChecked()
  })

  it('changes the theme through changeSettings and shows what the store holds', async () => {
    const change = spyOnChange()
    render(<SettingsScreen />)
    await userEvent.click(screen.getByRole('radio', { name: m.settings_theme_dark() }))
    expect(change).toHaveBeenCalledWith({ theme: 'dark' })
    expect(screen.getByRole('radio', { name: m.settings_theme_dark() })).toBeChecked()

    // A change that arrives from elsewhere, such as the command palette, is reflected too.
    await useAppStore.getState().changeSettings({ theme: 'light' })
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: m.settings_theme_light() })).toBeChecked(),
    )
  })

  it('treats low-vision as a theme and never as a size multiplier', async () => {
    const change = spyOnChange()
    render(<SettingsScreen />)
    const sizeBefore = settings().textSizePx
    await userEvent.click(
      screen.getByRole('radio', { name: new RegExp(m.settings_theme_lowVision()) }),
    )
    expect(change).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenCalledWith({ theme: 'lowVision' })
    expect(settings().theme).toBe('lowVision')
    expect(settings().textSizePx).toBe(sizeBefore)
  })

  it('changes motion, and with motion off disables sound and says so', async () => {
    const change = spyOnChange()
    render(<SettingsScreen />)
    await userEvent.click(screen.getByRole('radio', { name: m.settings_motion_off() }))
    expect(change).toHaveBeenCalledWith({ motion: 'off' })
    expect(screen.getByRole('checkbox', { name: m.settings_sound_label() })).toBeDisabled()
    expect(screen.getByText(m.settings_motion_off_consequence())).toBeInTheDocument()
  })

  it('turns sound on only while motion allows it, and sound starts off', async () => {
    const change = spyOnChange()
    render(<SettingsScreen />)
    const sound = screen.getByRole('checkbox', { name: m.settings_sound_label() })
    expect(sound).not.toBeChecked()
    await userEvent.click(sound)
    expect(change).toHaveBeenCalledWith({ sound: 'on' })
    expect(sound).toBeChecked()
  })

  it('sets the text size from a labelled slider and previews it at that size', async () => {
    const change = spyOnChange()
    render(<SettingsScreen />)
    const slider = screen.getByRole('slider', { name: m.settings_size_label() })
    expect(slider).toHaveAttribute('min', '24')
    expect(slider).toHaveAttribute('max', '40')
    fireEvent.change(slider, { target: { value: '40' } })
    expect(change).toHaveBeenCalledWith({ textSizePx: 40 })
    expect(screen.getByTestId('text-size-preview')).toHaveStyle({ fontSize: '40px' })
    expect(slider).toHaveAttribute('aria-valuetext', m.settings_size_value({ px: 40 }))
  })

  it('changes the error mode', async () => {
    const change = spyOnChange()
    render(<SettingsScreen />)
    await userEvent.click(
      screen.getByRole('radio', { name: new RegExp(m.settings_errors_freeBackspace()) }),
    )
    expect(change).toHaveBeenCalledWith({ errorMode: 'freeBackspace' })
    expect(settings().errorMode).toBe('freeBackspace')
  })

  it('moves the layout with the typing language, and lets the layout change on its own', async () => {
    const change = spyOnChange()
    render(<SettingsScreen />)
    const typing = screen.getByRole('group', { name: m.settings_typing_legend() })
    const english = typing.querySelector('input[value="en"]')
    if (!(english instanceof HTMLInputElement)) throw new Error('missing English radio')
    await userEvent.click(english)
    expect(change).toHaveBeenCalledWith({ typingLanguage: 'en' })
    expect(screen.getByRole('radio', { name: m.settings_layout_qwerty() })).toBeChecked()

    await userEvent.click(screen.getByRole('radio', { name: m.settings_layout_yq() }))
    expect(change).toHaveBeenCalledWith({ layoutId: 'yq' })
    expect(settings().typingLanguage).toBe('en')
  })

  it('switches the interface language independently of the typing language', async () => {
    const change = spyOnChange()
    render(<SettingsScreen />)
    const ui = screen.getByRole('group', { name: m.settings_ui_legend() })
    const english = ui.querySelector('input[value="en"]')
    if (!(english instanceof HTMLInputElement)) throw new Error('missing English radio')
    await userEvent.click(english)
    expect(change).toHaveBeenCalledWith({ interfaceLanguage: 'en' })
    expect(settings().typingLanguage).toBe('uk')
    await waitFor(() => expect(runtime.setLocale).toHaveBeenCalledWith('en'))
  })

  it('persists every change through the store seam so a reload finds it', async () => {
    const store = memoryStore()
    setProgressStore(store)
    render(<SettingsScreen />)
    await userEvent.click(screen.getByRole('radio', { name: m.settings_theme_dark() }))
    await waitFor(async () => {
      const loaded = await store.load()
      expect(typeof loaded === 'object' && loaded.settings.theme).toBe('dark')
    })
  })

  it('asks before clearing local data, then clears', async () => {
    const startFresh = vi.fn(() => Promise.resolve())
    useAppStore.setState({ startFresh })
    render(<SettingsScreen />)
    await userEvent.click(screen.getByRole('button', { name: m.settings_data_clear() }))
    expect(startFresh).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: m.settings_data_confirm_yes() }))
    expect(startFresh).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(m.settings_data_done())).toBeInTheDocument()
  })

  it('gives every form control an accessible name', () => {
    render(<SettingsScreen />)
    for (const control of screen.getAllByRole('radio')) expect(control).toHaveAccessibleName()
    expect(screen.getByRole('slider')).toHaveAccessibleName()
    expect(screen.getByRole('checkbox')).toHaveAccessibleName()
  })
})
